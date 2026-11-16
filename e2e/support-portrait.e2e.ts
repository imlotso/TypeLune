import {test,expect,ensureAdmin} from './fixtures';
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import type { SupportSnapshot } from '../server/support-settings';

test('portrait payment fixtures remain readable after saving and mobile display',async({page})=>{
 test.setTimeout(90000);
 const health=await page.request.get('/api/health');
 if(new URL(health.url()).hostname!=='127.0.0.1')throw new Error('Disposable loopback server required');
 await ensureAdmin(page.request);
 // Loopback test server emits production-style Secure cookies; desktop WebKit
 // does not send those over HTTP. Re-add only this disposable test session.
 const login=await page.request.post('/api/auth/login',{data:{identifier:'admin@example.test',password:'ci-password-123'}});
 expect(login.status()).toBe(200);
 const pair=login.headers()['set-cookie'].split(';')[0];const split=pair.indexOf('=');
 await page.context().addCookies([{name:pair.slice(0,split),value:pair.slice(split+1),domain:'127.0.0.1',path:'/',secure:false,httpOnly:true,sameSite:'Lax'}]);
 const ownerId=(await login.json()).user.id;
 const headers={'X-Workspace-Owner':ownerId};
 const beforeResponse=await page.request.get('/api/admin/support',{headers});
 expect(beforeResponse.status()).toBe(200);
 const before:SupportSnapshot=await beforeResponse.json();
 let saveResponse:ReturnType<typeof page.waitForResponse>|undefined;
 try {
 const codes=[];
 for(const [width,height] of [[1517,2274],[595,808]]){
  const payload='TypeLune synthetic NOT PAYMENT '+String(width)+' '+ 'dense-qr-check-'.repeat(12);
  const qr=await QRCode.toBuffer(payload,{width:width<1000?480:1200,margin:4,errorCorrectionLevel:'M'});
  const jpeg=await sharp({create:{width,height,channels:3,background:'white'}}).composite([{input:qr,gravity:'centre'}]).jpeg({quality:92}).toBuffer();
  codes.push({payload,jpeg});
 }
 await page.goto('/admin');await page.getByRole('button',{name:'捐赠设置',exact:true}).click();
 await page.getByLabel('支付宝收款码',{exact:true}).setInputFiles({name:'alipay-test.jpg',mimeType:'image/jpeg',buffer:codes[0].jpeg});
 await page.getByLabel('微信收款码',{exact:true}).setInputFiles({name:'wechat-test.jpg',mimeType:'image/jpeg',buffer:codes[1].jpeg});
 await page.getByLabel('显示捐赠入口').check();
 saveResponse=page.waitForResponse(response=>response.url().endsWith('/api/admin/support')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 expect((await saveResponse).status()).toBe(200);
 await expect(page.getByText('已保存',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'预览网站',exact:true}).click();await page.getByRole('button',{name:'支持 TypeLune',exact:true}).click();
 for(const [index,name] of ['支付宝收款码','微信收款码'].entries()){
  const enlarge=page.getByRole('button',{name:'放大查看'+name,exact:true});
  await expect(enlarge).toBeVisible();await enlarge.click();
  const image=page.getByRole('img',{name:'放大的'+name,exact:true});await expect(image).toBeVisible();
  const geometry=await image.evaluate((element:HTMLImageElement)=>({width:element.clientWidth,height:element.clientHeight,naturalWidth:element.naturalWidth,naturalHeight:element.naturalHeight}));
  expect(Math.abs(geometry.width/geometry.height-geometry.naturalWidth/geometry.naturalHeight)).toBeLessThan(0.01);
  const screenshot=await image.screenshot();const {data,info}=await sharp(screenshot).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  expect(jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data).toBe(codes[index].payload);
  await page.getByRole('button',{name:'返回收款码列表',exact:true}).click();
  await expect(enlarge).toBeFocused();
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/support-portrait-mobile.png'});
 } finally {
  // Restore the complete previous configuration even if rendering/decoding fails.
  // Use the revision of OUR successful write, never a fresh revision that could
  // overwrite a concurrent editor. A conflict must fail rather than clobber it.
  if(saveResponse){
   const response=await saveResponse;
   if(response.ok()){
    const saved:SupportSnapshot=await response.json();
    const restored=await page.request.post('/api/admin/support',{headers,data:{settings:before.settings,revision:saved.revision}});
    expect(restored.status(),'Restore previous support settings without overwriting concurrent changes').toBe(200);
    const after:SupportSnapshot=await restored.json();
    expect(after.settings).toEqual(before.settings);
    expect(after.revision).toBe(saved.revision+1);
   }
  }
 }
});
