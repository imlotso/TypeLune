import { beforeEach, afterEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import Fastify, {type FastifyInstance} from 'fastify';
import sharp from 'sharp';
import { AsyncSqlite } from '../server/database/sqlite';
import { createSiteSettings } from '../server/site-settings';
import { createSupportSettings, registerSupportAdminRoutes, registerSupportPublicRoutes } from '../server/support-settings';
let db:AsyncSqlite,app:ReturnType<typeof Fastify>,store:Awaited<ReturnType<typeof createSupportSettings>>;
let code:string;
beforeEach(async()=>{
 db=new AsyncSqlite(new Database(':memory:')); app=Fastify();
 const audit=async(actor:any)=>{if(actor.authVersion<0)throw Object.assign(new Error('revoked'),{statusCode:403});};
 await createSiteSettings(db,audit);store=await createSupportSettings(db,audit);
 registerSupportPublicRoutes(app,store);
 await app.register(async (routes:FastifyInstance)=>{routes.decorateRequest('admin');routes.addHook('onRequest',async(req,reply)=>{if(!['admin','stale'].includes(String(req.headers.authorization)))return reply.code(403).send();req.admin={id:'a',username:'a',authVersion:req.headers.authorization==='stale'?-1:0};});registerSupportAdminRoutes(routes,store);},{prefix:'/api/admin'});
 code='data:image/png;base64,'+(await sharp({create:{width:32,height:32,channels:3,background:'white'}}).png().toBuffer()).toString('base64');
});
afterEach(async()=>{await app.close();await db.close();});
const write=(settings:any,revision=0,authorization='admin')=>app.inject({method:'POST',url:'/api/admin/support',headers:{authorization},payload:{settings,revision}});
it('defaults private; saves sanitized QR, exposes only public configured fields and removes them when disabled',async()=>{
 expect((await app.inject('/api/site/support')).json()).toEqual({enabled:false});
 const result=await write({enabled:true,alipay:{dataUrl:code},wechat:null});expect(result.statusCode).toBe(200);
 const saved=result.json();expect(saved.settings.alipay.dataUrl).toMatch(/^data:image\/webp;base64,/);
 const publicResult=await app.inject('/api/site/support');expect(publicResult.headers['cache-control']).toBe('no-store');expect(publicResult.json()).toEqual({enabled:true,alipay:saved.settings.alipay});
 expect((await createSiteSettings(db,async()=>{}).then(s=>s.read())).settings.registrationEnabled).toBe(true);
 expect((await write({...saved.settings,enabled:false},1)).statusCode).toBe(200);expect((await app.inject('/api/site/support')).json()).toEqual({enabled:false});
});
it('rejects unauthorized writes, stale versions and revocation atomically',async()=>{
 const settings={enabled:true,alipay:{dataUrl:code},wechat:null};
 expect((await write(settings,0,'user')).statusCode).toBe(403);expect((await app.inject('/api/admin/support')).statusCode).toBe(403);
 expect((await write(settings,0,'stale')).statusCode).toBe(403);expect((await store.read()).revision).toBe(0);
 expect((await write(settings,7)).statusCode).toBe(409);expect((await app.inject({method:'POST',url:'/api/site/support',payload:{}})).statusCode).toBe(404);
});
it('rejects missing QR, SVG, remote URL, false MIME, malformed base64, oversized files and dimensions',async()=>{
 const invalid=['https://example.test/a.png','data:image/svg+xml;base64,PHN2Zy8+',code.replace('image/png','image/jpeg'),'data:image/png;base64,aaaa','data:image/png;base64,'+Buffer.alloc(1024*1024+1).toString('base64'),'data:image/png;base64,'+(await sharp({create:{width:4097,height:2,channels:3,background:'white'}}).png().toBuffer()).toString('base64')];
 expect((await write({enabled:true,alipay:null,wechat:null})).statusCode).toBe(400);
 for(const dataUrl of invalid)expect((await write({enabled:true,alipay:{dataUrl},wechat:null})).statusCode).toBe(400);
 expect((await store.read()).revision).toBe(0);
});
import QRCode from 'qrcode';
import jsQR from 'jsqr';
it('preserves a synthetic QR payload through upload, persistence and public response without crop or lossy encoding',async()=>{
 const payload='TypeLune test fixture - not a payment code - 20261115';
 const png=await QRCode.toBuffer(payload,{width:384,margin:4,errorCorrectionLevel:'M'});
 const saved=await write({enabled:true,alipay:{dataUrl:'data:image/png;base64,'+png.toString('base64')},wechat:null});
 expect(saved.statusCode).toBe(200);
 const data=(await app.inject('/api/site/support')).json().alipay.dataUrl;
 const {data:pixels,info}=await sharp(Buffer.from(data.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 expect(info.width).toBe(384);expect(info.height).toBe(384);
 expect(jsQR(new Uint8ClampedArray(pixels),info.width,info.height)?.data).toBe(payload);
});

it('identifies the failing channel and does not partially save either image',async()=>{
 const large='data:image/png;base64,'+(await sharp({create:{width:4097,height:2,channels:3,background:'white'}}).png().toBuffer()).toString('base64');
 const response=await write({enabled:true,alipay:{dataUrl:code},wechat:{dataUrl:large}});
 expect(response.statusCode).toBe(400);expect(response.json().code).toBe('SUPPORT_IMAGE_WECHAT_DIMENSIONS');
 expect((await store.read()).revision).toBe(0);expect((await app.inject('/api/site/support')).json()).toEqual({enabled:false});
});
