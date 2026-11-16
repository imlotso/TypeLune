import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import pg from 'pg';
import sharp from 'sharp';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {migratePostgres} from '../server/postgres/migrate';
import {PostgresDatabase} from '../server/postgres/database';
import {AsyncPostgres} from '../server/database/postgres';
import {bootstrapPostgresAdmin} from '../server/postgres/bootstrap';
import {createApp} from '../server/app';
import {createVercelHandler} from '../server/vercel';
const url=process.env.DAZI_TEST_DATABASE_URL;
(url?describe:describe.skip)('support QR on real PostgreSQL through Node HTTP and Vercel handler',()=>{
 let client:pg.Client,db:PostgresDatabase,node:Awaited<ReturnType<typeof createApp>>,handler:ReturnType<typeof createVercelHandler>,web:ReturnType<typeof createServer>;
 let schema:string,owner:string,nodeURL:string,vercelURL:string;
 beforeAll(async()=>{
  const parsed=new URL(url!);if(!['127.0.0.1','localhost','::1'].includes(parsed.hostname))throw new Error('Disposable loopback PostgreSQL only');
  schema='support_test_'+randomBytes(6).toString('hex');client=new pg.Client({connectionString:url});await client.connect();await client.query(`CREATE SCHEMA "${schema}"`);await client.query(`SET search_path TO "${schema}"`);
  await migratePostgres(client,{database:parsed.pathname.slice(1),schema});db=new PostgresDatabase(url!,schema);owner=await bootstrapPostgresAdmin(new AsyncPostgres(db),'SupportAdmin','support@example.test','isolated-password-123');
  node=await createApp({databaseUrl:url,postgresSchema:schema,codeSecret:'test-only-secret-value-at-least-32-characters',secureCookies:false});nodeURL=await node.listen({port:0,host:'127.0.0.1'});
  handler=createVercelHandler({DATABASE_URL:url,CODE_SECRET:'test-only-secret-value-at-least-32-characters',DAZI_DATABASE_SCHEMA:schema});web=createServer(handler);web.listen(0,'127.0.0.1');await once(web,'listening');vercelURL='http://127.0.0.1:'+(web.address() as {port:number}).port;
 },30000);
 afterAll(async()=>{await node?.close();if(web)await new Promise<void>(resolve=>web.close(()=>resolve()));await handler?.close();await db?.close();if(client){await client.query('SET search_path TO public');if(schema)await client.query(`DROP SCHEMA "${schema}" CASCADE`);await client.end();}});
 async function login(base:string){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({identifier:'SupportAdmin',password:'isolated-password-123'})});expect(r.status).toBe(200);return r.headers.get('set-cookie')!.split(';')[0];}
 async function post(base:string,cookie:string,settings:unknown,revision:number){return fetch(base+'/api/admin/support',{method:'POST',headers:{cookie,'content-type':'application/json',origin:base,'x-workspace-owner':owner},body:JSON.stringify({settings,revision})});}
 it('fails closed before explicit additive installation without breaking old schema verification',async()=>{
  for(const base of [nodeURL,vercelURL]){
   expect(await (await fetch(base+'/api/site/support')).json()).toEqual({enabled:false});
   const cookie=await login(base);expect((await fetch(base+'/api/admin/support',{headers:{cookie,'x-workspace-owner':owner}})).status).toBe(503);
  }
  const before=(await client.query('SELECT version,checksum FROM dazi_schema_migrations ORDER BY version')).rows;
  const sql=readFileSync('server/postgres/support-settings.sql','utf8');await client.query(sql);await client.query(sql);
  expect((await client.query('SELECT version,checksum FROM dazi_schema_migrations ORDER BY version')).rows).toEqual(before);await expect(db.verifySchema()).resolves.toBeUndefined();
 });
 it('persists exact decodable QR across both adapters, conflicts, restarts and legacy site settings',async()=>{
  const payload='TypeLune PG18 isolated scannability fixture, NOT PAYMENT';const png=await QRCode.toBuffer(payload,{width:512,margin:4});
  const settings={enabled:true,alipay:{dataUrl:'data:image/png;base64,'+png.toString('base64')},wechat:null};
  const cookie=await login(nodeURL);expect((await post(nodeURL,cookie,settings,0)).status).toBe(200);
  expect((await post(nodeURL,cookie,settings,0)).status).toBe(409);
  const fetched=await (await fetch(vercelURL+'/api/handler?__dazi_path=site%2Fsupport')).json();expect(fetched.enabled).toBe(true);expect(Object.keys(fetched).sort()).toEqual(['alipay','enabled']);
  const {data,info}=await sharp(Buffer.from(fetched.alipay.dataUrl.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});expect(jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data).toBe(payload);
  expect((await fetch(vercelURL+'/api/admin/support')).status).toBe(403);
  expect((await post(vercelURL,await login(vercelURL),{...settings,alipay:{dataUrl:'data:image/svg+xml;base64,PHN2Zy8+'}},1)).status).toBe(400);
  const restart=await createApp({databaseUrl:url,postgresSchema:schema,codeSecret:'test-only-secret-value-at-least-32-characters',secureCookies:false});try{expect((await restart.inject('/api/site/support')).json()).toEqual(fetched);}finally{await restart.close();}
  expect((await client.query('SELECT settings FROM site_settings')).rows).toEqual([]);
  expect((await post(vercelURL,await login(vercelURL),{enabled:false,alipay:null,wechat:null},1)).status).toBe(200);expect(await(await fetch(nodeURL+'/api/site/support')).json()).toEqual({enabled:false});
 });
});
