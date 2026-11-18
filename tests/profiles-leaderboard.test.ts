import {defaultSettings} from '../src/lib/models';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { createApp } from '../server/app';
import { syncWorkspace } from './workspace-sync-helper';
import { defaultBackground } from '../src/lib/background';
let app: Awaited<ReturnType<typeof createApp>>, directory: string, raw: Database.Database;
const codes = new Map<string,string>();
beforeEach(async()=>{directory=mkdtempSync(join(tmpdir(),'typelune-profile-'));app=await createApp({databasePath:join(directory,'test.sqlite'),secureCookies:false,mailer:{async sendCode(email,code){codes.set(email,code);}}});raw=new Database(join(directory,'test.sqlite'));});
afterEach(async()=>{raw.close();await app.close();rmSync(directory,{recursive:true,force:true});});
async function register(name:string){const email=name+'@example.test';await app.inject({method:'POST',url:'/api/auth/code',payload:{email,purpose:'register'}});const response=await app.inject({method:'POST',url:'/api/auth/register',payload:{email,username:name,password:'testing-password-123',code:codes.get(email)}});expect(response.statusCode).toBe(200);const user=response.json().user;return {user,headers:{cookie:'session='+response.cookies.find(c=>c.name==='session')!.value,'x-workspace-owner':user.id}};}
it('normalizes an uploaded avatar, persists privacy across sessions and denies direct public reads after disabling',async()=>{
 const alice=await register('alice');const bob=await register('bobby');
 const png=await sharp({create:{width:400,height:200,channels:3,background:'#8eabd1'}}).png().toBuffer();
 const avatar='data:image/png;base64,'+png.toString('base64');
 const save=await app.inject({method:'POST',url:'/api/account/profile',headers:alice.headers,payload:{displayName:'Alice',avatar,profilePublic:true}});
 expect(save.statusCode).toBe(200);expect(save.json().user.avatar).toMatch(/^data:image\/webp;base64,/);
 const metadata=await sharp(Buffer.from(save.json().user.avatar.split(',')[1],'base64')).metadata();expect(metadata.width).toBe(192);expect(metadata.height).toBe(192);
 const image=await sharp({create:{width:2,height:2,channels:3,background:'#607080'}}).webp().toBuffer();
 const background=defaultBackground('dark',{image:'data:image/webp;base64,'+image.toString('base64'),name:'private-filename.jpg',width:2,height:2});
 await syncWorkspace(app,alice.headers,[{kind:'background',id:'dark',updatedAt:Date.now(),value:background},{kind:'settings',id:'preferences',updatedAt:Date.now(),value:{...defaultSettings,wallpaperFollowSite:{dark:false}}}]);
 const publicView=await app.inject('/api/profiles/'+alice.user.id);expect(publicView.statusCode).toBe(200);expect(publicView.json().backgrounds.dark.image).toBe(background.image);
 expect(publicView.body).not.toContain('alice@example.test');expect(publicView.body).not.toContain('password');expect(publicView.body).not.toContain('session');
 const wrong=await app.inject({method:'POST',url:'/api/account/profile',headers:{...bob.headers,'x-workspace-owner':alice.user.id},payload:{displayName:'Alice',avatar:null,profilePublic:false}});expect(wrong.statusCode).toBe(403);
 const hide=await app.inject({method:'POST',url:'/api/account/profile',headers:alice.headers,payload:{displayName:'Alice',avatar:'moon',profilePublic:false}});expect(hide.statusCode).toBe(200);
 expect((await app.inject('/api/profiles/'+alice.user.id)).statusCode).toBe(404);
 expect((await app.inject({url:'/api/profiles/'+alice.user.id,headers:bob.headers})).statusCode).toBe(404);
 expect((await app.inject({url:'/api/profiles/'+alice.user.id,headers:alice.headers})).statusCode).toBe(200);
 expect((await app.inject({url:'/api/me',headers:alice.headers})).json().user).toMatchObject({profilePublic:false,avatar:'moon'});
 const unrelated=await app.inject({method:'POST',url:'/api/account/profile',headers:alice.headers,payload:{displayName:'Alice updated',avatar:'moon'}});expect(unrelated.json().user.profilePublic).toBe(false);expect((await app.inject('/api/profiles/'+alice.user.id)).statusCode).toBe(404);
 const bad=await app.inject({method:'POST',url:'/api/account/profile',headers:alice.headers,payload:{displayName:'Alice',avatar:'data:image/svg+xml;base64,PHN2Zy8+',profilePublic:true}});expect(bad.statusCode).toBe(400);
 expect((await app.inject('/api/profiles/'+alice.user.id)).statusCode).toBe(404);
});
it('aggregates best published scores across durations, strictness, modes and articles, with independent boards and real pagination',async()=>{
 const alice=await register('alice'); const now=Date.now();
 const insert=raw.prepare(`INSERT INTO challenges(id,owner,language,difficulty,duration,target,started_at,finished_at,status,published,nickname,speed,accuracy,mode,strict,article_id) VALUES (?,?, 'en','beginner',?,'sample',?,?,'finished',1,?,?,99,?,?,?)`);
 insert.run('a1','u:'+alice.user.id,60,now-60000,now,'alice',35,'timed',0,'en-beginner-1');
 insert.run('a2','u:'+alice.user.id,120,now-120000,now,'alice',72,'timed',1,'en-beginner-2');
 insert.run('a3','u:'+alice.user.id,300,now-120000,now,'alice',80,'article',0,'en-beginner-3');
 for(let i=0;i<14;i++)insert.run('g'+i,'g:guest-'+i,60+i*60,now-60000,now,'visitor'+i,50+i,'timed',i%2,'en-beginner-1');
 const members=(await app.inject('/api/leaderboard?board=user&language=en&difficulty=beginner')).json();expect(members.total).toBe(1);expect(members.entries[0]).toMatchObject({speed:80,userId:alice.user.id});
 const guests=(await app.inject('/api/leaderboard?board=guest&language=en&difficulty=beginner&page=2')).json();expect(guests.total).toBe(14);expect(guests.entries).toHaveLength(4);expect(guests.entries[0].rank).toBe(11);expect(guests.entries.some((e:any)=>e.userId)).toBe(false);
 const legacy=(await app.inject('/api/leaderboard?board=user&language=en&difficulty=beginner&duration=60&mode=timed&strict=false')).json();expect(legacy.entries[0].speed).toBe(35);
 raw.prepare("UPDATE challenges SET ranking_removed=1 WHERE id='a3'").run();expect((await app.inject('/api/leaderboard?board=user&language=en&difficulty=beginner')).json().entries[0].speed).toBe(72);
 expect((await app.inject('/api/leaderboard?board=user&language=en&difficulty=beginner&page=0')).statusCode).toBe(400);
});

it('public wallpaper defaults follow the shared source until the owner explicitly opts out',async()=>{
 const alice=await register('alice');const shared=defaultBackground('light',{image:'https://w.wallhaven.cc/full/aa/wallhaven-aaaaaa.jpg',name:'Wallhaven aaaaaa',width:3840,height:2160});
 raw.prepare('INSERT INTO wallpaper_settings(id,settings,revision) VALUES(1,?,1)').run(JSON.stringify({enabled:true,styles:['nature']}));raw.prepare('INSERT INTO wallpaper_rotation(id,config_revision,slot,background,updated_at) VALUES(1,1,0,?,?)').run(JSON.stringify(shared),Date.now());
 const response=await app.inject('/api/profiles/'+alice.user.id);expect(response.statusCode).toBe(200);expect(response.json().backgrounds.light.image).toBe(shared.image);expect(response.json().backgrounds.dark.image).toBe(shared.image);
 await syncWorkspace(app,alice.headers,[{kind:'settings',id:'preferences',updatedAt:Date.now(),value:{...defaultSettings,wallpaperFollowSite:{light:false}}}]);expect((await app.inject({url:'/api/workspace',headers:{...alice.headers,'x-workspace-background-references':'1'}})).statusCode).toBe(426);expect((await app.inject({url:'/api/workspace',headers:{...alice.headers,'x-workspace-background-references':'1','x-workspace-appearance':'2'}})).statusCode).toBe(200);const privateChoice=(await app.inject('/api/profiles/'+alice.user.id)).json();expect(privateChoice.backgrounds.light).toBeUndefined();expect(privateChoice.backgrounds.dark.image).toBe(shared.image);
});
it('defaults to all difficulties and periods while keeping each difficulty filter and each player’s best score',async()=>{
 const now=Date.now();const add=raw.prepare("INSERT INTO challenges(id,owner,language,difficulty,duration,target,started_at,finished_at,status,published,nickname,speed,accuracy,mode,strict,article_id) VALUES (?,?,'zh',?,60,'sample',?,?,'finished',1,?,?,99,'timed',0,'zh-beginner-1')");
 add.run('b','g:one','beginner',now-60000,now,'visitor一',90);add.run('a','g:one','advanced',now-60000,now,'visitor一',130);add.run('i','g:two','intermediate',now-60000,now,'visitor二',110);add.run('old','g:three','beginner',now-30*86400000-60000,now-30*86400000,'visitor三',100);
 const all=await app.inject('/api/leaderboard?board=guest&language=zh');expect(all.statusCode).toBe(200);expect(all.json().total).toBe(3);expect(all.json().entries.map((r:any)=>r.speed)).toEqual([130,110,100]);
 for(const [difficulty,speeds] of [['beginner',[100,90]],['intermediate',[110]],['advanced',[130]]] as const){const result=await app.inject('/api/leaderboard?board=guest&language=zh&difficulty='+difficulty);expect(result.statusCode).toBe(200);expect(result.json().entries.map((r:any)=>r.speed)).toEqual(speeds);}
 expect((await app.inject('/api/leaderboard?board=guest&language=zh&difficulty=all&period=week')).json().total).toBe(2);
});
