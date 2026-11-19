import { afterEach, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerWallpapers, validWallpaper } from '../server/wallpapers';
import { isBackgroundConfig } from '../src/lib/background';
import { wallpaperStyleNames,wallpaperStyles,type WallpaperStyle } from '../src/lib/wallpaper-policy';
const row=(id='ab12cd',kind:WallpaperStyle='nature',width=3840,height=2160)=>({id,purity:'sfw',category:wallpaperStyles[kind].category,dimension_x:width,dimension_y:height,path:`https://w.wallhaven.cc/full/${id.slice(0,2)}/wallhaven-${id}.jpg`,tags:[{name:kind==='portrait'?'portrait':'scenery'}]});
afterEach(()=>vi.unstubAllGlobals());
it('returns only approved image URLs, deduplicates metadata requests and never downloads image bytes',async()=>{
 const app=Fastify();registerWallpapers(app);const source=row();
 const fetcher=vi.fn(async(url:string)=>{if(!url.startsWith('https://wallhaven.cc/api/'))throw Error('Image bytes must not be fetched');return new Response(JSON.stringify(url.includes('/search?')?{data:[source]}:{data:source}));});vi.stubGlobal('fetch',fetcher);
 const results=await Promise.all(['light','dark'].map(theme=>app.inject('/api/wallpapers/daily?kind=nature&theme='+theme)));
 expect(results.map(value=>value.statusCode)).toEqual([200,200]);expect(fetcher).toHaveBeenCalledTimes(2);
 expect(results[0].json().background.image).toBe(source.path);expect(isBackgroundConfig(results[0].json().background)).toBe(true);expect(results[0].json().background.shade).toBe(25);expect(results[1].json().background.shade).toBe(45);
 expect(fetcher.mock.calls[0][0]).toContain('purity=100');await app.close();
});
it('rejects inappropriate portraits before returning any reference',async()=>{
 const app=Fastify();registerWallpapers(app);const source={...row('ab12cd','portrait'),tags:[{name:'portrait'},{name:'bikini'}]};
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('/search?')?{data:[source]}:{data:source}))));
 const response=await app.inject('/api/wallpapers/daily?kind=portrait');expect(response.statusCode).toBe(503);expect(response.json().background).toBeUndefined();await app.close();
});
it.each(['detail','metadata'])('continues past a %s failure',async failure=>{
 const app=Fastify();registerWallpapers(app);let details=0;
 const fetcher=vi.fn(async(url:string)=>{
  if(url.includes('/search?'))return new Response(JSON.stringify({data:[{id:'aaaaaa'},{id:'bbbbbb'}]}));
  const candidate=row(url.split('/').pop());if(++details===1){if(failure==='detail')return new Response('unavailable',{status:503});candidate.purity='nsfw';}
  return new Response(JSON.stringify({data:candidate}));
 });vi.stubGlobal('fetch',fetcher);const response=await app.inject('/api/wallpapers/daily');expect(response.statusCode).toBe(200);expect(details).toBe(2);expect(isBackgroundConfig(response.json().background)).toBe(true);await app.close();
});
it('allows retry after recovery',async()=>{
 const app=Fastify();registerWallpapers(app);let searches=0;const source=row();
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('/search?')?(++searches===1?new Response('unavailable',{status:503}):new Response(JSON.stringify({data:[source]}))):new Response(JSON.stringify({data:source}))));
 expect((await app.inject('/api/wallpapers/daily')).statusCode).toBe(503);expect((await app.inject('/api/wallpapers/daily')).statusCode).toBe(200);await app.close();
});
it('bounds concurrent provider lookups while sharing a pending lookup and allowing later retries', async () => {
  const app = Fastify();
  registerWallpapers(app);
  let release = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const fetcher = vi.fn(async (url: string) => {
    await pending;
    return Response.json({ data: row(url.split('/').pop()) });
  });
  vi.stubGlobal('fetch', fetcher);

  const request = async (index: number, theme = 'light') =>
    app.inject(`/api/wallpapers/daily?id=${String(index).padStart(6, '0')}&theme=${theme}`);
  const active = Array.from({ length: 8 }, (_, index) => request(index));
  try {
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(8));
    const shared = request(0, 'dark');
    const busy = await request(8);
    expect(busy.statusCode).toBe(503);
    expect(busy.headers['retry-after']).toBe('5');
    expect(fetcher).toHaveBeenCalledTimes(8);
    release();
    expect((await Promise.all([...active, shared])).map(({ statusCode }) => statusCode)).toEqual(Array(9).fill(200));
    expect((await request(8)).statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(9);
  } finally {
    release();
    await Promise.allSettled(active);
    await app.close();
  }
});
it('rejects malformed, untrusted and mismatched image destinations',()=>{
 const source=row();for(const path of ['not-a-url','http://w.wallhaven.cc/full/ab/wallhaven-ab12cd.jpg','https://example.test/image.jpg',source.path+'?redirect=x',source.path.replace('ab12cd','aaaaaa')])expect(validWallpaper({...source,path},'nature')).toBe(false);
 expect(validWallpaper({...source,tags:{}},'nature')).toBe(false);expect(validWallpaper({...source,dimension_x:Infinity},'nature')).toBe(false);
});
it('returns a different image while keeping the ordinary daily default stable',async()=>{
 const app=Fastify();registerWallpapers(app);vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('/search?')?{data:[row('aaaaaa'),row('bbbbbb')]}:{data:row(url.split('/').pop())}))));
 const first=(await app.inject('/api/wallpapers/daily')).json().background;const changed=await app.inject('/api/wallpapers/daily?exclude='+first.daily.id);
 expect(changed.statusCode).toBe(200);expect(changed.json().background.daily.id).not.toBe(first.daily.id);expect((await app.inject('/api/wallpapers/daily')).json().background.daily.id).toBe(first.daily.id);await app.close();
});
it('selects an original at least as large as the display without resampling or downloading it',async()=>{
 const app=Fastify();registerWallpapers(app);const source=row();const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('/search?')?{data:[source]}:{data:source})));vi.stubGlobal('fetch',fetcher);
 const large=await app.inject('/api/wallpapers/daily?width=3840&height=2160');expect(large.json().background).toMatchObject({image:source.path,width:3840,height:2160,daily:{resolution:'3840x2160'}});
 const small=await app.inject('/api/wallpapers/daily?width=1920&height=1080');expect(small.json().background).toMatchObject({image:source.path,width:3840,height:2160,daily:{resolution:'1920x1080'}});
 const calls=fetcher.mock.calls.length;await app.inject('/api/wallpapers/daily?width=3840&height=2160');expect(fetcher).toHaveBeenCalledTimes(calls);expect(fetcher.mock.calls[0][0]).toContain('atleast=3840x2160');await app.close();
});
it.each(wallpaperStyleNames)('supports safe %s style metadata',async kind=>{
 const app=Fastify();registerWallpapers(app);const source=row('ab12cd',kind);const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('/search?')?{data:[source]}:{data:source})));vi.stubGlobal('fetch',fetcher);
 const response=await app.inject('/api/wallpapers/daily?kind='+kind);expect(response.statusCode).toBe(200);expect(response.json().background.daily.kind).toBe(kind);expect(fetcher.mock.calls[0][0]).toContain('categories='+wallpaperStyles[kind].categories);await app.close();
});
it('resolves the same legacy image by ID without choosing another picture',async()=>{
 const app=Fastify();registerWallpapers(app);const source=row();const fetcher=vi.fn(async()=>new Response(JSON.stringify({data:source})));vi.stubGlobal('fetch',fetcher);
 const response=await app.inject('/api/wallpapers/daily?id=ab12cd');expect(response.statusCode).toBe(200);expect(response.json().background.image).toBe(source.path);expect(fetcher).toHaveBeenCalledTimes(1);await app.close();
});
it.each(['kind=nsfw','width=9999&height=2160','width=3840','width=5120&height=5120','width=NaN&height=1080','exclude=bad','exclude=aaaaaa,../../secret','id=../../secret'])('rejects invalid options before metadata fetch (%s)',async query=>{
 const app=Fastify();registerWallpapers(app);const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect((await app.inject('/api/wallpapers/daily?'+query)).statusCode).toBe(400);expect(fetcher).not.toHaveBeenCalled();await app.close();
});
