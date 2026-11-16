import { expect, it } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { prepareSupportImage } from '../server/support-settings';

it.each([[595,808],[1517,2274]])('preserves a synthetic portrait JPEG QR at %i x %i without resizing or cropping', async(width,height)=>{
 const payload=`TypeLune synthetic QR ${width}x${height} NOT PAYMENT`;
 const size=width<1000?400:900;
 const qr=await QRCode.toBuffer(payload,{width:size,margin:4});
 const jpeg=await sharp({create:{width,height,channels:3,background:'#eee'}}).composite([{input:qr,gravity:'centre'}]).jpeg({quality:90}).withMetadata({exif:{IFD0:{Artist:'private synthetic metadata'}}}).toBuffer();
 expect(jpeg.length).toBeLessThan(1024*1024);
 const result=await prepareSupportImage('data:image/jpeg;base64,'+jpeg.toString('base64'));
 const bytes=Buffer.from(result.dataUrl.split(',')[1],'base64');
 const metadata=await sharp(bytes).metadata();expect(metadata.exif).toBeUndefined();
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 expect([info.width,info.height]).toEqual([width,height]);
 expect(jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data).toBe(payload);
});
it('reports lossless conversion expansion separately from original file size',async()=>{
 let state=12345;const pixels=Buffer.alloc(1000*1000*3);for(let i=0;i<pixels.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;pixels[i]=state>>>24;}
 const jpeg=await sharp(pixels,{raw:{width:1000,height:1000,channels:3}}).jpeg({quality:35}).toBuffer();
 expect(jpeg.length).toBeLessThan(1024*1024);
 await expect(prepareSupportImage('data:image/jpeg;base64,'+jpeg.toString('base64'))).rejects.toMatchObject({issue:'NORMALIZED_SIZE'});
});
it('rejects total-pixel bombs even when each edge fits, without normalizing',async()=>{
 const png=await sharp({create:{width:2100,height:2100,channels:3,background:'white'}}).png().toBuffer();
 await expect(prepareSupportImage('data:image/png;base64,'+png.toString('base64'))).rejects.toThrow();
});
