import {expect,it,vi} from 'vitest';
import Fastify from 'fastify';
import sharp from 'sharp';
import {createWallpaperImages,registerWallpaperImages} from '../server/wallpaper-images';
import {wallpaperImageSource,wallpaperImageSet} from '../src/lib/wallpaper-image';

const detail=(id='aaaaaa')=>({id,purity:'sfw',category:'general',dimension_x:3000,dimension_y:2000,path:`https://w.wallhaven.cc/full/${id.slice(0,2)}/wallhaven-${id}.jpg`,tags:[{name:'mountains'}]});
it('serves one approved image as proportional small/large variants, never enlarges, and deduplicates downloads',async()=>{
 const original=await sharp({create:{width:3000,height:2000,channels:3,background:'#7488ad'}}).jpeg().toBuffer();const fetcher=vi.fn(async(url:string)=>url.includes('/api/')?Buffer.from(JSON.stringify({data:detail()})):original);const store=createWallpaperImages(fetcher);
 const [a,b]=await Promise.all([store.image('aaaaaa',1280),store.image('aaaaaa',1280)]);expect(a).toEqual(b);expect(fetcher).toHaveBeenCalledTimes(2);expect(await sharp(a).metadata()).toMatchObject({format:'webp',width:1280,height:853});const large=await store.image('aaaaaa',3840);expect(await sharp(large).metadata()).toMatchObject({width:3000,height:2000});expect(fetcher).toHaveBeenCalledTimes(2);expect(a.length).toBeLessThan(original.length);
 const app=Fastify();registerWallpaperImages(app,store);try{const response=await app.inject('/api/wallpapers/image/aaaaaa?w=1280');expect(response.statusCode).toBe(200);expect(response.headers['content-type']).toBe('image/webp');expect(response.headers['cache-control']).toContain('s-maxage=43200');expect(response.rawPayload).toEqual(a);expect((await app.inject('/api/wallpapers/image/aaaaaa?w=2000')).statusCode).toBe(400);expect((await app.inject('/api/wallpapers/image/aaaaaa?w=1280&url=http://127.0.0.1')).statusCode).toBe(400);}finally{await app.close();}
});
it.each([
 {...detail(),path:'https://127.0.0.1/private'},
 {...detail(),purity:'nsfw'},
 {...detail(),tags:[{name:'nudity'}]},
 {...detail(),category:'people',tags:[{name:'fashion'}]},
 {...detail(),id:'bbbbbb'},
])('rejects an unsafe provider record before downloading any image bytes: %j',async row=>{
 const fetcher=vi.fn(async()=>Buffer.from(JSON.stringify({data:row})));const store=createWallpaperImages(fetcher);await expect(store.image('aaaaaa',1280)).rejects.toThrow();expect(fetcher).toHaveBeenCalledOnce();
});
it('does not cache corrupt images or successful-looking image errors',async()=>{
 const fetcher=vi.fn(async(url:string)=>url.includes('/api/')?Buffer.from(JSON.stringify({data:detail()})):Buffer.from('not an image'));const app=Fastify();registerWallpaperImages(app,createWallpaperImages(fetcher));try{for(let i=0;i<2;i++){const response=await app.inject('/api/wallpapers/image/aaaaaa?w=1280');expect(response.statusCode).toBe(503);expect(response.headers['cache-control']).toBe('no-store');}expect(fetcher).toHaveBeenCalledTimes(4);}finally{await app.close();}
});
it('uses same-origin variants with a stable image ID at every screen size',()=>{
 const url=detail().path;expect(wallpaperImageSource(url,800)).toBe('/api/wallpapers/image/aaaaaa?w=1280');expect(wallpaperImageSource(url,2560)).toBe('/api/wallpapers/image/aaaaaa?w=2560');expect(wallpaperImageSet(url)).toContain('/api/wallpapers/image/aaaaaa?w=5120 5120w');expect(wallpaperImageSet(url,false)).toBeUndefined();expect(wallpaperImageSource('/api/backgrounds/files/a')).toBe('/api/backgrounds/files/a');expect(wallpaperImageSource('/assets/lake-default.webp')).toBe('/assets/lake-default.webp');
});
