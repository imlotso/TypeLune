import {Readable} from 'node:stream';
import sharp from 'sharp';
import type {FastifyInstance} from 'fastify';
import {boundedFetch,validWallpaper} from './wallpapers.js';
import {wallpaperStyleNames,wallpaperWidths} from '../src/lib/wallpaper-policy.js';

const expiry=30*60_000;
export const wallpaperImageRoute = '/api/wallpapers/image/:id';
class ImageCache {
  private entries=new Map<string,{bytes:Buffer;until:number}>();private size=0;
  constructor(private limit:number){}
  get(key:string){const entry=this.entries.get(key);if(!entry)return;if(entry.until<Date.now()){this.remove(key);return;}this.entries.delete(key);this.entries.set(key,entry);return entry.bytes;}
  private remove(key:string){const entry=this.entries.get(key);if(entry){this.size-=entry.bytes.length;this.entries.delete(key);}}
  set(key:string,bytes:Buffer){this.remove(key);if(bytes.length>this.limit)return;while(this.size+bytes.length>this.limit)this.remove(this.entries.keys().next().value!);this.entries.set(key,{bytes,until:Date.now()+expiry});this.size+=bytes.length;}
}

/** Public provider images only. Account uploads never pass through this cache. */
export function createWallpaperImages(fetchBytes=boundedFetch){
  const originals=new ImageCache(48*1024*1024),variants=new ImageCache(32*1024*1024);
  const sources=new Map<string,Promise<Buffer>>(),pending=new Map<string,Promise<Buffer>>();
  let active=0;const queue:Array<()=>void>=[];
  async function limited<T>(work:()=>Promise<T>):Promise<T>{
    if(active>=2){if(queue.length>=8)throw Error('Wallpaper service busy');await new Promise<void>(resolve=>queue.push(resolve));}else active++;
    try{return await work();}finally{const next=queue.shift();if(next)next();else active--;}
  }
  async function source(id:string){
    const cached=originals.get(id);if(cached)return cached;
    if(!sources.has(id))sources.set(id,(async()=>{
      const signal=AbortSignal.timeout(35_000);
      const detail=JSON.parse((await fetchBytes('https://wallhaven.cc/api/v1/w/'+id,200_000,'wallhaven.cc',signal)).toString()).data;
      if(detail?.id!==id||!wallpaperStyleNames.some(kind=>validWallpaper(detail,kind,{width:1,height:1})))throw Error('Unapproved wallpaper');
      const bytes=await fetchBytes(detail.path,24*1024*1024,'w.wallhaven.cc',signal,'image/jpeg,image/png,image/webp');
      const info=await sharp(bytes,{limitInputPixels:40_000_000,failOn:'warning'}).metadata();
      if(!['jpeg','png','webp'].includes(info.format??'')||(info.pages??1)!==1||info.width!==detail.dimension_x||info.height!==detail.dimension_y)throw Error('Invalid wallpaper image');
      originals.set(id,bytes);return bytes;
    })().finally(()=>sources.delete(id)));
    return sources.get(id)!;
  }
  return {async image(id:string,width:number){
    if(!/^[a-z0-9]{6}$/.test(id)||!wallpaperWidths.includes(width as typeof wallpaperWidths[number]))throw Error('Invalid wallpaper variant');
    const key=id+':'+width,cached=variants.get(key);if(cached)return cached;
    if(!pending.has(key)){
      if(pending.size>=10)throw Error('Wallpaper service busy');
      pending.set(key,limited(async()=>{const bytes=await source(id);const image=await sharp(bytes,{limitInputPixels:40_000_000,failOn:'warning'}).rotate().resize({width,withoutEnlargement:true}).webp({quality:84,effort:4}).toBuffer();if(image.length>8*1024*1024)throw Error('Wallpaper variant too large');variants.set(key,image);return image;}).finally(()=>pending.delete(key)));
    }
    return pending.get(key)!;
  }};
}
export function registerWallpaperImages(app:FastifyInstance,store=createWallpaperImages()){
  app.get(wallpaperImageRoute,{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(request,reply)=>{
    const {id}=request.params as {id:string};const query=request.query as Record<string,string>;const width=Number(query.w??1920);
    if(!/^[a-z0-9]{6}$/.test(id)||!wallpaperWidths.includes(width as typeof wallpaperWidths[number])||Object.keys(query).some(key=>key!=='w')||query.w!==undefined&&!/^\d{3,4}$/.test(query.w))return reply.code(400).send({error:'壁纸尺寸无效'});
    try{const bytes=await store.image(id,width);reply.header('Content-Type','image/webp').header('Cache-Control','public, max-age=3600, s-maxage=43200, stale-while-revalidate=3600').header('Vercel-CDN-Cache-Control','public, max-age=43200, stale-while-revalidate=3600').header('Content-Security-Policy',"default-src 'none'; sandbox");return reply.send(Readable.from((function*(){for(let offset=0;offset<bytes.length;offset+=64*1024)yield bytes.subarray(offset,offset+64*1024);})()));}
    catch{return reply.code(503).header('Cache-Control','no-store').header('Retry-After','30').send({error:'壁纸暂不可用，请稍后重试'});}
  });
}
