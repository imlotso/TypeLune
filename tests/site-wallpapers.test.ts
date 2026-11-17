import {expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import {AsyncSqlite} from '../server/database/sqlite';
import {createSiteWallpapers} from '../server/site-wallpapers';
import {defaultBackground} from '../src/lib/background';
import {siteWallpaperIntervalMs,wallpaperStyleNames} from '../src/lib/wallpaper-policy';
import type {WallpaperRequest} from '../server/wallpapers';
const actor={id:'admin',username:'admin',authVersion:0};
async function fixture(){
 const raw=new Database(':memory:');raw.exec('CREATE TABLE users(id TEXT PRIMARY KEY)');const db=new AsyncSqlite(raw);let now=Math.floor(Date.now()/siteWallpaperIntervalMs)*siteWallpaperIntervalMs+100;let calls=0;
 const provider=vi.fn(async(request:WallpaperRequest)=>{const id=['aaaaaa','bbbbbb','cccccc'][calls++%3];return{...defaultBackground('light',{image:`https://w.wallhaven.cc/full/${id.slice(0,2)}/wallhaven-${id}.jpg`,name:id,width:3840,height:2160}),daily:{id,day:'2026-11-17',kind:request.kind}};});
 const audit=vi.fn(async()=>{});const store=await createSiteWallpapers(db,audit,()=>now,provider);return{raw,db,store,provider,audit,setTime:(value:number)=>now=value,getTime:()=>now};
}
it('persists one global URL and changes it exactly at the next 12-hour slot',async()=>{
 const f=await fixture();try{
  expect(wallpaperStyleNames.length).toBeGreaterThanOrEqual(5);await f.store.update(actor,{enabled:true,styles:['nature','city']},0);
  const first=await f.store.refresh();const id=first.background!.daily!.id;expect(first.background!.image).toMatch(/^https:/);await f.store.refresh();expect(f.provider).toHaveBeenCalledTimes(1);
  f.setTime(Math.floor(f.getTime()/siteWallpaperIntervalMs)*siteWallpaperIntervalMs+siteWallpaperIntervalMs-1);expect((await f.store.refresh()).background!.daily!.id).toBe(id);
  f.setTime(f.getTime()+1);const next=await f.store.refresh();expect(next.background!.daily!.id).not.toBe(id);expect(f.provider).toHaveBeenCalledTimes(2);expect(f.provider.mock.calls[1][0].exclude).toEqual([id]);
  expect(JSON.stringify(f.raw.prepare('SELECT * FROM wallpaper_rotation').get())).not.toContain('data:image');
 }finally{await f.db.close();}
});
it('rejects stale admin revisions and clears the previous URL when disabled',async()=>{
 const f=await fixture();try{await f.store.update(actor,{enabled:true,styles:['forest']},0);await f.store.refresh();expect(await f.store.update(actor,{enabled:false,styles:['forest']},0)).toBeNull();expect((await f.store.read()).settings.enabled).toBe(true);await f.store.update(actor,{enabled:false,styles:['forest']},1);expect((await f.store.refresh()).background).toBeNull();expect(f.raw.prepare('SELECT background FROM wallpaper_rotation').get()).toEqual({background:null});}finally{await f.db.close();}
});
it('retains the last working image on a failed rotation without stamping it fresh',async()=>{
 const f=await fixture();try{await f.store.update(actor,{enabled:true,styles:['nature']},0);const old=await f.store.refresh();f.setTime(f.getTime()+siteWallpaperIntervalMs);f.provider.mockRejectedValueOnce(new Error('provider down'));const failed=await f.store.refresh();expect(failed.background).toEqual(old.background);expect(failed.updatedAt).toBe(old.updatedAt);await f.store.refresh();expect(f.provider).toHaveBeenCalledTimes(2);f.setTime(f.getTime()+60_001);expect((await f.store.refresh()).background!.daily!.id).not.toBe(old.background!.daily!.id);}finally{await f.db.close();}
});
it('uses a database lease so independent application instances do not publish competing refreshes',async()=>{
 const f=await fixture();try{await f.store.update(actor,{enabled:true,styles:['nature']},0);let finish!:(value:any)=>void;f.provider.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const pending=f.store.refresh();await vi.waitFor(()=>expect(f.provider).toHaveBeenCalledOnce());const second=await createSiteWallpapers(f.db,f.audit,f.getTime,f.provider);expect((await second.refresh()).background).toBeNull();finish({...defaultBackground('light',{image:'https://w.wallhaven.cc/full/aa/wallhaven-aaaaaa.jpg',name:'a',width:3840,height:2160}),daily:{id:'aaaaaa',day:'2026-11-17',kind:'nature'}});await pending;expect((await second.refresh()).background!.daily!.id).toBe('aaaaaa');expect(f.provider).toHaveBeenCalledOnce();}finally{await f.db.close();}
});
it.skipIf(!process.env.DAZI_TEST_DATABASE_URL)('coordinates independent PostgreSQL instances across rotation boundaries',async()=>{
 const {default:pg}=await import('pg');const {randomBytes}=await import('node:crypto');const {AsyncPostgres}=await import('../server/database/postgres');const {PostgresDatabase}=await import('../server/postgres/database');const {wallpaperSchema}=await import('../server/wallpaper-schema');
 const url=process.env.DAZI_TEST_DATABASE_URL!;if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Loopback database required');const client=new pg.Client({connectionString:url});await client.connect();const schema='wallpaper_rotation_'+randomBytes(8).toString('hex');await client.query(`CREATE SCHEMA "${schema}"`);await client.query(`SET search_path TO "${schema}"`);await client.query('CREATE TABLE users(id TEXT PRIMARY KEY)');await client.query(wallpaperSchema);
 const firstDb=new AsyncPostgres(new PostgresDatabase(url,schema));const secondDb=new AsyncPostgres(new PostgresDatabase(url,schema));let now=siteWallpaperIntervalMs*100+100;let finish!:(value:any)=>void;let calls=0;const result=(id:string)=>({...defaultBackground('light',{image:`https://w.wallhaven.cc/full/${id.slice(0,2)}/wallhaven-${id}.jpg`,name:id,width:3840,height:2160}),daily:{id,day:'2026-11-17',kind:'nature' as const}});const provider=vi.fn(async()=>++calls===1?new Promise<any>(resolve=>{finish=resolve;}):result('bbbbbb'));
 try{const a=await createSiteWallpapers(firstDb,async()=>{},()=>now,provider),b=await createSiteWallpapers(secondDb,async()=>{},()=>now,provider);await a.update(actor,{enabled:true,styles:['nature']},0);const pending=a.refresh();await vi.waitFor(()=>expect(provider).toHaveBeenCalledOnce());expect((await b.refresh()).background).toBeNull();finish(result('aaaaaa'));await pending;expect((await b.refresh()).background!.daily!.id).toBe('aaaaaa');now+=siteWallpaperIntervalMs;expect((await b.refresh()).background!.daily!.id).toBe('bbbbbb');expect((await a.refresh()).background!.daily!.id).toBe('bbbbbb');expect(provider).toHaveBeenCalledTimes(2);}finally{await firstDb.close();await secondDb.close();await client.query('SET search_path TO public');await client.query(`DROP SCHEMA "${schema}" CASCADE`);await client.end();}
});
