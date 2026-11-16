import {test,expect,ensureAdmin} from './fixtures';
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';

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
 await page.getByLabel('显示捐赠入口').check();await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByText('已保存',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'预览网站',exact:true}).click();await page.getByRole('button',{name:'支持 TypeLune',exact:true}).click();
 for(const [index,name] of ['支付宝收款码','微信收款码'].entries()){
  const image=page.getByRole('img',{name,exact:true});await expect(image).toBeVisible();
  const screenshot=await image.screenshot();const {data,info}=await sharp(screenshot).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  expect(jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data).toBe(codes[index].payload);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/support-portrait-mobile.png'});
});
