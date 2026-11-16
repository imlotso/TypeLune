import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const base='http://127.0.0.1:4213';
const server=spawn(process.execPath,['--import','tsx','e2e/server.ts'],{cwd:process.cwd(),env:{...process.env,E2E_PORT:'4213'},windowsHide:true,stdio:['ignore','pipe','pipe']});
let log='';server.stderr.on('data',d=>log+=d);
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'zh-CN'});
 const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(base+'/library');
 const card=page.locator('.library-import-card');await card.waitFor();await card.scrollIntoViewIfNeeded();
 mkdirSync('docs/qa/screenshots/2026-11-16-article-cta',{recursive:true});
 await page.screenshot({path:'docs/qa/screenshots/2026-11-16-article-cta/desktop-guest.png'});
 await page.getByRole('button',{name:'登录同步'}).click();await page.getByRole('dialog').waitFor();
 console.log('Guest CTA opened authentication dialog:',await page.getByRole('dialog').innerText());
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{localStorage.setItem('typelune.ui-locale.v1','en');});await page.reload();await card.scrollIntoViewIfNeeded();
 await page.screenshot({path:'docs/qa/screenshots/2026-11-16-article-cta/mobile-english.png'});
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await card.scrollIntoViewIfNeeded();await page.waitForTimeout(400);await page.screenshot({path:'docs/qa/screenshots/2026-11-16-article-cta/mobile-english-dark.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 const email='cta_owner@example.test'; const request=context.request;
 await request.post(base+'/api/auth/code',{data:{email,purpose:'register'}});
 const code=(await(await request.get(base+'/__e2e__/email-code?email='+email+'&purpose=register')).json()).code;
 const result=await request.post(base+'/api/auth/register',{data:{email,username:'cta_owner',password:'only-disposable-cta-password',code}});
 if(!result.ok())throw Error('Registration failed: '+await result.text());
 await page.goto(base+'/library');await page.getByRole('button',{name:/Import your article|导入自己的文章/}).click();await page.getByRole('dialog',{name:/New article|新建文章/}).waitFor();
 await page.getByLabel(/Import TXT|导入 TXT/).setInputFiles({name:'sample.txt',mimeType:'text/plain',buffer:Buffer.from('This is my own practice article.')});
 await page.getByRole('button',{name:/^(Save|保存)$/}).click();await page.getByRole('heading',{name:'sample',exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'sample',exact:true}).waitFor();
 console.log('Authenticated import saved and survived refresh; mobile overflow absent.');
 await context.close();
}finally{await browser.close();server.kill();writeFileSync('cta-preview-server.log',log);}
