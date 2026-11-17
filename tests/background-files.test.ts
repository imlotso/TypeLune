import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import pg from 'pg';
import sharp from 'sharp';
import {createApp} from '../server/app';
import {normalizeBackgroundLosslessly,backgroundChunkBytes} from '../server/background-files';
import {defaultBackground,type BackgroundImage} from '../src/lib/background';
import {migratePostgres} from '../server/postgres/migrate';
import {wallpaperSchema} from '../server/wallpaper-schema';
import {syncWorkspace} from './workspace-sync-helper';
import {createVercelHandler} from '../server/vercel';
import {createServer} from 'node:http';
import {once} from 'node:events';

it('preserves every decoded pixel and the original dimensions during lossless normalization',async()=>{
 const pixels=randomBytes(80*60*4);const source=await sharp(pixels,{raw:{width:80,height:60,channels:4}}).png().toBuffer();
 const normalized=await normalizeBackgroundLosslessly(source,'image/png');expect(normalized.info).toMatchObject({width:80,height:60});
 expect(await sharp(normalized.data).ensureAlpha().raw().toBuffer()).toEqual(await sharp(source).ensureAlpha().raw().toBuffer());
});

for(const dialect of ['sqlite',...(process.env.DAZI_TEST_DATABASE_URL?['postgres']:[])] as const){
 describe('background file lifecycle on '+dialect,()=>{
  let app:Awaited<ReturnType<typeof createApp>>,dir:string,raw:Database.Database|undefined,setup:pg.Client|undefined,schema:string;
  const codes=new Map<string,string>();const password='background-lossless-test';let userNumber=0;
  const count=async(table:string)=>{if(raw)return (raw.prepare('SELECT COUNT(*) AS n FROM '+table).get() as {n:number}).n;return Number((await setup!.query('SELECT COUNT(*) AS n FROM '+table)).rows[0].n);};
  beforeAll(async()=>{
   dir=mkdtempSync(join(tmpdir(),'background-files-'));const common={secureCookies:false,codeSecret:'background-files-test-key'.repeat(2),mailer:{async sendCode(email:string,code:string){codes.set(email,code);}}};
   if(dialect==='sqlite'){const path=join(dir,'db.sqlite');app=await createApp({...common,databasePath:path});raw=new Database(path);}
   else{const url=process.env.DAZI_TEST_DATABASE_URL!;const target=new URL(url);if(!['127.0.0.1','localhost'].includes(target.hostname))throw Error('Loopback test database required');setup=new pg.Client({connectionString:url});await setup.connect();schema='background_files_'+randomBytes(8).toString('hex');await setup.query(`CREATE SCHEMA "${schema}"`);await setup.query(`SET search_path TO "${schema}"`);await migratePostgres(setup,{database:target.pathname.slice(1),schema});await setup.query(wallpaperSchema);app=await createApp({...common,databaseUrl:url,postgresSchema:schema});}
  });
  afterAll(async()=>{await app?.close();raw?.close();if(setup){await setup.query('SET search_path TO public');await setup.query(`DROP SCHEMA "${schema}" CASCADE`);await setup.end();}if(dir)rmSync(dir,{recursive:true,force:true});});
  async function register(){const username='bg_'+(++userNumber),email=username+'@example.test';expect((await app.inject({method:'POST',url:'/api/auth/code',payload:{email,purpose:'register'}})).statusCode).toBe(200);const response=await app.inject({method:'POST',url:'/api/auth/register',payload:{email,username,password,code:codes.get(email)}});expect(response.statusCode).toBe(200);const user=response.json().user;return{cookie:'session='+response.cookies.find(item=>item.name==='session')!.value,'x-workspace-owner':user.id};}
  async function upload(headers:Record<string,string>,bytes:Buffer){const uploadId=randomUUID(),digest=createHash('sha256').update(bytes).digest('hex'),chunkCount=Math.ceil(bytes.length/backgroundChunkBytes);
   for(let chunkIndex=0;chunkIndex<chunkCount;chunkIndex++){const response=await app.inject({method:'POST',url:'/api/backgrounds/uploads/chunks',headers,payload:{uploadId,name:'original.png',mime:'image/png',totalBytes:bytes.length,digest,chunkCount,chunkIndex,data:bytes.subarray(chunkIndex*backgroundChunkBytes,(chunkIndex+1)*backgroundChunkBytes).toString('base64')}});expect(response.statusCode).toBe(200);}
   const response=await app.inject({method:'POST',url:'/api/backgrounds/uploads/complete',headers,payload:{uploadId}});expect(response.statusCode).toBe(200);return{uploadId,image:response.json().image as BackgroundImage};
  }
  it('requires authentication, rejects owner spoofing and denies member configuration writes',async()=>{
   const owner=await register();const foreign=await register();
   expect((await app.inject({method:'POST',url:'/api/backgrounds/uploads/complete',payload:{uploadId:randomUUID()}})).statusCode).toBe(401);
   expect((await app.inject({method:'POST',url:'/api/backgrounds/uploads/complete',headers:{...owner,'x-workspace-owner':foreign['x-workspace-owner']},payload:{uploadId:randomUUID()}})).statusCode).toBe(403);
   expect((await app.inject({url:'/api/admin/wallpaper',headers:owner})).statusCode).toBe(403);
   expect((await app.inject({method:'POST',url:'/api/admin/wallpaper',headers:owner,payload:{settings:{enabled:true,styles:['nature']},revision:0}})).statusCode).toBe(403);
  });
  it('stores uploads separately, permanently removes replaced bytes, and prevents stale/foreign resurrection',async()=>{
   const owner=await register();const aBytes=await sharp({create:{width:70,height:50,channels:3,background:'#8ba0bc'}}).png().toBuffer();const first=await upload(owner,aBytes);
   expect(await count('background_upload_chunks')).toBe(0);expect((await app.inject(first.image.image)).statusCode).toBe(404);
   const a={kind:'background',id:'light',updatedAt:Date.now(),value:defaultBackground('light',first.image)};expect((await syncWorkspace(app,owner,[a])).statusCode).toBe(200);
   const original=await app.inject({url:first.image.image,headers:owner});expect(original.statusCode).toBe(200);expect(original.headers['cache-control']).toContain('no-store');expect(await sharp(original.rawPayload).raw().toBuffer()).toEqual(await sharp(aBytes).raw().toBuffer());
   expect((await app.inject({url:'/api/workspace',headers:owner})).statusCode).toBe(426);
   const bBytes=await sharp({create:{width:80,height:60,channels:3,background:'#bc98ac'}}).png().toBuffer();const second=await upload(owner,bBytes);
   const b={...a,updatedAt:Date.now()+1,value:defaultBackground('light',second.image)};expect((await syncWorkspace(app,owner,[b])).statusCode).toBe(200);
   expect((await app.inject({url:first.image.image,headers:owner})).statusCode).toBe(404);expect(await count('background_files')).toBe(1);expect((await app.inject({url:second.image.image,headers:owner})).statusCode).toBe(200);
   const resurrect=await syncWorkspace(app,owner,[{...a,updatedAt:Date.now()+2}]);expect(resurrect.statusCode).toBe(409);expect(resurrect.json().error).toContain('已删除');expect(await count('background_files')).toBe(1);
   const foreign=await register();expect((await syncWorkspace(app,foreign,[{...b,updatedAt:Date.now()+3}])).statusCode).toBe(409);
   const privacy=await app.inject({method:'POST',url:'/api/account/profile',headers:owner,payload:{displayName:'Private owner',avatar:null,profilePublic:false}});expect(privacy.statusCode).toBe(200);expect((await app.inject({url:second.image.image,headers:foreign})).statusCode).toBe(404);expect((await app.inject({url:second.image.image,headers:owner})).statusCode).toBe(200);
   const third=await upload(owner,aBytes);const cloud=(await app.inject({url:'/api/workspace',headers:{...owner,'x-workspace-protocol':'2','x-workspace-background-references':'1'}})).json();
   const failed=await app.inject({method:'POST',url:'/api/workspace/sync',headers:{...owner,'x-workspace-protocol':'2','x-workspace-background-references':'1'},payload:{generation:cloud.generation,items:[{...b,updatedAt:Date.now()+4,baseRevision:0,value:defaultBackground('light',third.image)}]}});expect(failed.statusCode).toBe(409);expect((await app.inject({url:second.image.image,headers:owner})).statusCode).toBe(200);
   expect((await app.inject({method:'POST',url:'/api/backgrounds/uploads/discard',headers:owner,payload:{uploadId:third.uploadId}})).statusCode).toBe(200);expect(await count('background_files')).toBe(1);
   expect((await syncWorkspace(app,owner,[{kind:'background',id:'light',updatedAt:Date.now()+5,deleted:true}])).statusCode).toBe(200);expect(await count('background_files')).toBe(0);expect(await count('background_upload_chunks')).toBe(0);expect((await app.inject({url:second.image.image,headers:owner})).statusCode).toBe(404);
  });
  it('round-trips an original spanning multiple bounded upload requests without data URLs',async()=>{
   const owner=await register();const pixels=randomBytes(1400*1300*3);const bytes=await sharp(pixels,{raw:{width:1400,height:1300,channels:3}}).png().toBuffer();expect(bytes.length).toBeGreaterThan(4.5*1024*1024);
   const uploaded=await upload(owner,bytes);expect(uploaded.image.image).toMatch(/^\/api\/backgrounds\/files\//);const response=await app.inject({url:uploaded.image.image,headers:owner});expect(response.statusCode).toBe(200);expect(await sharp(response.rawPayload).raw().toBuffer()).toEqual(pixels);expect(await count('background_upload_chunks')).toBe(0);
   await app.listen({host:'127.0.0.1',port:0});const address=app.server.address() as {port:number};
   const live=await fetch(`http://127.0.0.1:${address.port}`+uploaded.image.image,{headers:owner});expect(live.status).toBe(200);expect((await live.arrayBuffer()).byteLength).toBe(response.rawPayload.length);
   if(dialect==='postgres'){
    const handler=createVercelHandler({DATABASE_URL:process.env.DAZI_TEST_DATABASE_URL,CODE_SECRET:'background-files-test-key'.repeat(2),DAZI_DATABASE_SCHEMA:schema});const server=createServer((request,reply)=>{void handler(request,reply);});server.listen(0,'127.0.0.1');await once(server,'listening');
    try{const port=(server.address() as {port:number}).port;const result=await fetch(`http://127.0.0.1:${port}`+uploaded.image.image,{headers:owner});expect(result.status).toBe(200);expect((await result.arrayBuffer()).byteLength).toBe(response.rawPayload.length);}finally{await handler.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
   }
   await app.inject({method:'POST',url:'/api/backgrounds/uploads/discard',headers:owner,payload:{uploadId:uploaded.uploadId}});
  },20_000);
 });
}
