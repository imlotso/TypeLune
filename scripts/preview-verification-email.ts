import { verificationEmail } from '../server/verification-email.js';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const folder = 'docs/qa/email-preview'; mkdirSync(folder,{recursive:true});
const mail=verificationEmail('noreply@example.test','123456','login');
writeFileSync(`${folder}/typelune-verification.html`,mail.html);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
for (const [name,width,height] of [['desktop',640,590],['mobile',390,590]]) {
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 await page.setContent(mail.html); await page.screenshot({path:`${folder}/typelune-email-${name}.png`,fullPage:true});
 console.log(JSON.stringify({name,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
 await page.close();
}
await browser.close();

