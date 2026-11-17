import { afterEach, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import sharp from 'sharp';
import { registerWallpapers, validWallpaper } from '../server/wallpapers';
import { isBackgroundConfig } from '../src/lib/background';
afterEach(()=>vi.unstubAllGlobals());
it('uses only SFW accepted host images, transforms pixels, shares cached requests and validates preferences',async()=>{
 const app=Fastify();registerWallpapers(app);
 const image=await sharp({create:{width:1920,height:1080,channels:3,background:'#60758d'}}).png().toBuffer();
 const row={id:'ab12cd',purity:'sfw',category:'general',dimension_x:1920,dimension_y:1080,path:'https://w.wallhaven.cc/full/ab/wallhaven-ab12cd.png',tags:[{name:'nature'}]};
 const fetcher=vi.fn(async(url:any)=>url.includes('/search?')?new Response(JSON.stringify({data:[row]})):url.includes('/api/v1/w/')?new Response(JSON.stringify({data:row})):new Response(image));vi.stubGlobal('fetch',fetcher);
 const results=await Promise.all([app.inject('/api/wallpapers/daily?kind=nature&theme=light'),app.inject('/api/wallpapers/daily?kind=nature&theme=dark')]);
 expect(results.map(r=>r.statusCode)).toEqual([200,200]);expect(fetcher).toHaveBeenCalledTimes(3);
 expect(isBackgroundConfig(results[0].json().background)).toBe(true);expect(results[0].json().background.shade).toBe(25);expect(results[1].json().background.shade).toBe(45);
 expect(fetcher.mock.calls[0][0]).toContain('purity=100');expect((await app.inject('/api/wallpapers/daily?kind=nsfw')).statusCode).toBe(400);
 await app.close();
});
it('rejects inappropriate portraits and leaves no unsafe background in the response',async()=>{
 const app=Fastify();registerWallpapers(app);
 const row={id:'ab12cd',purity:'sfw',category:'people',dimension_x:1920,dimension_y:1080,path:'https://w.wallhaven.cc/full/ab/a.jpg',tags:[{name:'portrait'},{name:'bikini'}]};
 const fetcher=vi.fn(async(url:any)=>new Response(JSON.stringify(url.includes('/search?')?{data:[row]}:{data:row})));vi.stubGlobal('fetch',fetcher);
 const response=await app.inject('/api/wallpapers/daily?kind=portrait');expect(response.statusCode).toBe(503);expect(response.json().background).toBeUndefined();expect(fetcher.mock.calls.some(([url])=>url.startsWith('https://w.'))).toBe(false);await app.close();
});
it.each(['detail', 'download', 'decode'])('continues to another candidate after a %s failure', async failure => {
 const app=Fastify();registerWallpapers(app);
 const image=await sharp({create:{width:1920,height:1080,channels:3,background:'#60758d'}}).png().toBuffer();
 let details=0; let images=0;
 const fetcher=vi.fn(async(url:string)=>{
  if(url.includes('/search?'))return new Response(JSON.stringify({data:[{id:'aaaaaa'},{id:'bbbbbb'}]}));
  if(url.includes('/api/v1/w/')) {
   if(++details===1&&failure==='detail')return new Response('unavailable',{status:503});
   return new Response(JSON.stringify({data:{id:url.split('/').pop(),purity:'sfw',category:'general',dimension_x:1920,dimension_y:1080,path:'https://w.wallhaven.cc/full/ab/image.png',tags:[{name:'landscape'}]}}));
  }
  images++;
  if(images===1&&failure==='download')return new Response('unavailable',{status:503});
  if(images===1&&failure==='decode')return new Response('damaged image');
  return new Response(image);
 });vi.stubGlobal('fetch',fetcher);
 const response=await app.inject('/api/wallpapers/daily?kind=nature');
 expect(response.statusCode).toBe(200);expect(details).toBe(2);expect(images).toBe(failure==='detail'?1:2);expect(isBackgroundConfig(response.json().background)).toBe(true);await app.close();
});
it('allows an immediate manual retry after the provider recovers', async()=>{
 const app=Fastify();registerWallpapers(app);
 const image=await sharp({create:{width:1920,height:1080,channels:3,background:'#60758d'}}).png().toBuffer();
 const row={id:'ab12cd',purity:'sfw',category:'general',dimension_x:1920,dimension_y:1080,path:'https://w.wallhaven.cc/full/ab/image.png',tags:[{name:'landscape'}]};
 let searches=0;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(url.includes('/search?'))return ++searches===1?new Response('unavailable',{status:503}):new Response(JSON.stringify({data:[row]}));
  return url.includes('/api/v1/w/')?new Response(JSON.stringify({data:row})):new Response(image);
 }));
 expect((await app.inject('/api/wallpapers/daily?kind=nature')).statusCode).toBe(503);
 expect((await app.inject('/api/wallpapers/daily?kind=nature')).statusCode).toBe(200);
 expect(searches).toBe(2);await app.close();
});
it('rejects malformed destinations and unsafe tags without throwing out the whole candidate list',()=>{
 const row={id:'ab12cd',purity:'sfw',category:'general',dimension_x:1920,dimension_y:1080,path:'not-a-url',tags:[]};
 expect(validWallpaper(row,'nature')).toBe(false);
 expect(validWallpaper({...row,path:'http://w.wallhaven.cc/image.png'},'nature')).toBe(false);
 expect(validWallpaper({...row,path:'https://w.wallhaven.cc/image.png',tags:{}},'nature')).toBe(false);
 expect(validWallpaper({...row,path:'https://w.wallhaven.cc/image.png',category:'people',tags:[{name:'faces'},{name:'bikini'}]},'portrait')).toBe(false);
});
