import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { createApp } from '../server/app';
import { migratePostgres } from '../server/postgres/migrate';
import { AsyncPostgres } from '../server/database/postgres';
import { PostgresDatabase } from '../server/postgres/database';
import { seedPostgresCatalog } from '../server/postgres/seed';
import { createVercelHandler } from '../server/vercel';
import { createServer } from 'node:http';
import { once } from 'node:events';
const url=process.env.DAZI_TEST_DATABASE_URL;
(url?describe:describe.skip)('public profiles on actual PostgreSQL through Node and Vercel HTTP',()=>{
 let setup:pg.Client,app:Awaited<ReturnType<typeof createApp>>,schema:string;const codes=new Map<string,string>();
 beforeAll(async()=>{const parsed=new URL(url!);if(!['127.0.0.1','localhost'].includes(parsed.hostname))throw Error('Loopback test database required');setup=new pg.Client({connectionString:url});await setup.connect();schema='typelune_profile_'+randomBytes(8).toString('hex');await setup.query(`CREATE SCHEMA "${schema}"`);await setup.query(`SET search_path TO "${schema}"`);await migratePostgres(setup,{database:parsed.pathname.slice(1),schema});const db=new PostgresDatabase(url!,schema);await seedPostgresCatalog(new AsyncPostgres(db),Date.now);await db.close();app=await createApp({databaseUrl:url,postgresSchema:schema,secureCookies:false,codeSecret:'profile-test-only-key'.repeat(2),mailer:{async sendCode(email,code){codes.set(email,code);}}});});
 afterAll(async()=>{await app?.close();if(setup){await setup.query('SET search_path TO public');if(schema)await setup.query(`DROP SCHEMA "${schema}" CASCADE`);await setup.end();}});
 it('persists custom avatars and rejects hidden profiles through both HTTP adapters',async()=>{
  const email='profile@example.test';await app.inject({method:'POST',url:'/api/auth/code',payload:{email,purpose:'register'}});const response=await app.inject({method:'POST',url:'/api/auth/register',payload:{email,username:'profiletest',password:'test-password-123',code:codes.get(email)}});expect(response.statusCode).toBe(200);const user=response.json().user;const headers={cookie:'session='+response.cookies[0].value,'x-workspace-owner':user.id};
  const image=await sharp({create:{width:60,height:90,channels:3,background:'#a0b0c0'}}).png().toBuffer();const avatar='data:image/png;base64,'+image.toString('base64');
  const saved=await app.inject({method:'POST',url:'/api/account/profile',headers,payload:{displayName:'Profile PG',avatar,profilePublic:true}});expect(saved.statusCode).toBe(200);expect(saved.json().user.avatar).toMatch(/^data:image\/webp/);
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address() as {port:number};
  const handler=createVercelHandler({DATABASE_URL:url,CODE_SECRET:'profile-test-only-key'.repeat(2),DAZI_DATABASE_SCHEMA:schema});const server=createServer((req,res)=>{void handler(req,res);});server.listen(0,'127.0.0.1');await once(server,'listening');const vercel=server.address() as {port:number};
  try{
   for(const port of [address.port,vercel.port]){const result=await fetch(`http://127.0.0.1:${port}/api/profiles/${user.id}`);expect(result.status).toBe(200);expect((await result.json()).displayName).toBe('Profile PG');}
   await app.inject({method:'POST',url:'/api/account/profile',headers,payload:{displayName:'Profile PG',avatar:saved.json().user.avatar,profilePublic:false}});
   for(const port of [address.port,vercel.port])expect((await fetch(`http://127.0.0.1:${port}/api/profiles/${user.id}`)).status).toBe(404);
   expect((await app.inject({url:'/api/me',headers})).json().user.profilePublic).toBe(false);
   const board=await app.inject('/api/leaderboard?board=user&language=en&difficulty=beginner');expect(board.statusCode,board.body).toBe(200);expect(board.json().entries).toEqual([]);
  }finally{await handler.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
 });
});
