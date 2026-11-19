import {mkdirSync} from 'node:fs';
import {test,expect} from './fixtures';
const shots='docs/qa/screenshots/2026-11-17-wallpaper-delivery';
const background=(id='aaaaaa')=>({image:`https://w.wallhaven.cc/full/${id.slice(0,2)}/wallhaven-${id}.jpg`,name:'Wallhaven '+id,width:3840,height:2160,fit:'cover',positionX:50,positionY:50,blur:0,shade:20,daily:{id,day:new Date().toISOString().slice(0,10),kind:'nature'}});
async function appearance(page:import('@playwright/test').Page){await page.getByRole('button',{name:'外观',exact:true}).click();return page.getByRole('dialog',{name:'外观',exact:true});}
async function alpha(page:import('@playwright/test').Page,selector:string,pseudo?:string){return page.locator(selector).first().evaluate((element,pseudo)=>{const c=getComputedStyle(element,pseudo).backgroundColor;const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')!;ctx.fillStyle=c;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[3]/255;},pseudo);}
test('page controls affect real panel, row, input and navigation paints; reset and cancelled previews preserve the wallpaper',async({page})=>{
 let global=background();const external:string[]=[];
 await page.route('https://*.wallhaven.cc/**',route=>{external.push(route.request().url());return route.abort();});
 await page.route('**/api/site/wallpaper?*',route=>route.fulfill({json:{enabled:true,background:global,serverTime:Date.now()}}));
 await page.route('**/api/wallpapers/image/**',route=>route.fulfill({path:'public/assets/lake-default.webp',contentType:'image/webp'}));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');await expect(page.getByTestId('custom-background-image')).toBeVisible();await page.getByRole('textbox',{name:'当前行输入'}).fill('我与父亲');
 let dialog=await appearance(page);for(const name of ['容器透明度','工作区透明度','导航栏透明度'])await dialog.getByRole('slider',{name,exact:true}).fill('100');await dialog.getByRole('slider',{name:'容器毛玻璃',exact:true}).fill('0');await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 for(const selector of ['.site-header','.typing-panel','.practice-line','.line-pair textarea'])expect(await alpha(page,selector)).toBe(0);expect(await alpha(page,'.workspace','::before')).toBe(0);await expect(page.locator('.line-source').first()).toHaveCSS('opacity','1');await expect(page.getByTestId('typed-count')).toHaveText('4');
 mkdirSync(shots,{recursive:true});await page.screenshot({path:shots+'/transparent-page.png'});
 await page.reload();expect(await alpha(page,'.site-header')).toBe(0);expect(await alpha(page,'.practice-line')).toBe(0);
 dialog=await appearance(page);await dialog.getByRole('button',{name:'日间背景图',exact:true}).click();const editor=page.getByRole('dialog',{name:'日间背景',exact:true});await expect(editor.getByRole('checkbox',{name:'跟随全站壁纸刷新',exact:true})).toBeChecked();await expect(editor.getByLabel('背景图片',{exact:true})).toBeDisabled();await editor.getByRole('slider',{name:'容器透明度',exact:true}).fill('50');expect(await alpha(page,'.practice-line')).toBeCloseTo(0.5,2);await editor.getByRole('button',{name:'取消',exact:true}).click();expect(await alpha(page,'.practice-line')).toBe(0);
 dialog=await appearance(page);await dialog.getByRole('button',{name:'重置透明度和效果',exact:true}).click();await expect.poll(()=>alpha(page,'.practice-line')).toBeGreaterThan(0.95);await expect.poll(()=>alpha(page,'.site-header')).toBe(1);await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 global=background('bbbbbb');await page.reload();await expect(page.getByTestId('custom-background-image')).toHaveAttribute('src',/\/image\/bbbbbb/);expect(external).toEqual([]);
 dialog=await appearance(page);await dialog.getByRole('button',{name:'夜间',exact:true}).click();await dialog.getByRole('slider',{name:'容器透明度',exact:true}).fill('35');await dialog.getByRole('slider',{name:'导航栏透明度',exact:true}).fill('60');await dialog.getByRole('button',{name:'关闭',exact:true}).click();await page.screenshot({path:shots+'/dark-page.png'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await alpha(page,'.site-header')).toBeCloseTo(.4,2);
 await page.setViewportSize({width:390,height:844});dialog=await appearance(page);await dialog.getByRole('slider',{name:'导航栏透明度',exact:true}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:shots+'/mobile-appearance.png',fullPage:true});
});

test('guest wallpaper controls explain the site-follow lock and require saving the change', async ({ page }) => {
  await page.goto('/');
  async function openEditor() {
    await (await appearance(page)).getByRole('button', { name: '日间背景图', exact: true }).click();
  }
  await openEditor();

  const editor = page.getByRole('dialog', { name: '日间背景', exact: true });
  const follow = editor.getByRole('checkbox', { name: '跟随全站壁纸刷新', exact: true });
  const upload = editor.getByRole('button', { name: '上传图片', exact: true });
  const provider = editor.getByRole('button', { name: '解锁 Wallhaven 壁纸选项', exact: true });
  const prompt = page.getByRole('dialog', { name: '先关闭全站壁纸跟随', exact: true });
  let pickerCount = 0;
  page.on('filechooser', () => pickerCount++);

  await expect(follow).toBeChecked();
  await upload.click();
  await expect(prompt).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Shift+Tab');
  await expect(prompt.getByRole('button', { name: '关闭跟随', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(prompt).toHaveCount(0);
  await expect(upload).toBeFocused();
  await expect(follow).toBeChecked();

  await provider.click({ position: { x: 8, y: 30 } });
  await expect(prompt).toBeVisible();
  expect(pickerCount).toBe(0);
  await prompt.getByRole('button', { name: '关闭跟随', exact: true }).click();
  await expect(follow).not.toBeChecked();
  await expect(follow).toBeFocused();
  await expect(editor.getByRole('button', { name: '获取今日壁纸' })).toBeEnabled();
  await Promise.all([page.waitForEvent('filechooser'), upload.click()]);
  await editor.getByRole('button', { name: '取消', exact: true }).click();
  await openEditor();
  await expect(follow).toBeChecked();

  await upload.click();
  await prompt.getByRole('button', { name: '关闭跟随', exact: true }).click();
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.reload();
  await openEditor();
  await expect(follow).not.toBeChecked();
  await expect(editor.getByLabel('背景图片', { exact: true })).toBeEnabled();
});

test('a failed shared image keeps the last loaded picture and user effects while retrying',async({page})=>{
 let global=background(),fail=true;await page.clock.install();
 await page.route('**/api/site/wallpaper?*',r=>r.fulfill({json:{enabled:true,background:global,serverTime:Date.now()}}));
 await page.route('**/api/wallpapers/image/**',r=>r.request().url().includes('bbbbbb')&&fail?r.fulfill({status:503,body:'Unavailable'}):r.fulfill({path:'public/assets/lake-default.webp',contentType:'image/webp'}));
 await page.goto('/');const image=page.getByTestId('custom-background-image');await expect.poll(()=>image.evaluate((i:HTMLImageElement)=>i.naturalWidth)).toBeGreaterThan(0);let dialog=await appearance(page);await dialog.getByRole('slider',{name:'容器透明度',exact:true}).fill('40');await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 global=background('bbbbbb');await page.clock.fastForward(60_001);await expect(page.getByRole('button',{name:'重试壁纸',exact:true})).toBeVisible();await expect(image).toHaveAttribute('src',/image\/aaaaaa/);expect(await alpha(page,'.practice-line')).toBeCloseTo(.6,2);fail=false;await page.getByRole('button',{name:'重试壁纸',exact:true}).click();await expect(image).toHaveAttribute('src',/image\/bbbbbb/);await expect(page.getByRole('button',{name:'重试壁纸',exact:true})).toHaveCount(0);
});
test('account appearance and the explicit site-follow choice persist across independent browsers',async({page,browser,baseURL})=>{
 let global=background();const route=async(target:import('@playwright/test').Page)=>{await target.route('**/api/site/wallpaper?*',r=>r.fulfill({json:{enabled:true,background:global,serverTime:Date.now()}}));await target.route('**/api/wallpapers/image/**',r=>r.fulfill({path:'public/assets/lake-default.webp',contentType:'image/webp'}));};await route(page);
 const name='surface_'+Date.now().toString(36),email=name+'@example.test',password='surface-sync-test-password';await page.request.post('/api/auth/code',{data:{email,purpose:'register'}});const {code}=await(await page.request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json();expect((await page.request.post('/api/auth/register',{data:{email,username:name,password,code}})).ok()).toBe(true);await page.goto('/');
 let dialog=await appearance(page);await dialog.getByRole('slider',{name:'容器透明度',exact:true}).fill('35');await dialog.getByRole('slider',{name:'导航栏透明度',exact:true}).fill('45');await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 const cloud=async()=>await(await page.request.get('/api/workspace',{headers:{'X-Workspace-Background-References':'1','X-Workspace-Appearance':'2'}})).json();await expect.poll(async()=> (await cloud()).items.find((i:any)=>i.kind==='settings')?.value.surfaceAppearance?.light?.headerOpacity).toBe(55);
 const ctx=await browser.newContext({baseURL,locale:'zh-CN'});try{expect((await ctx.request.post('/api/auth/login',{data:{identifier:name,password}})).ok()).toBe(true);const other=await ctx.newPage();await route(other);await other.goto('/');await expect.poll(()=>alpha(other,'.site-header')).toBeCloseTo(.55,2);expect(await alpha(other,'.practice-line')).toBeCloseTo(.65,2);
 dialog=await appearance(page);await dialog.getByRole('button',{name:'日间背景图',exact:true}).click();await page.getByRole('checkbox',{name:'跟随全站壁纸刷新',exact:true}).uncheck();await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);global=background('bbbbbb');await other.reload();await expect(other.getByTestId('custom-background-image')).toHaveAttribute('src',/image\/aaaaaa/);
 dialog=await appearance(page);await dialog.getByRole('button',{name:'日间背景图',exact:true}).click();await page.getByRole('checkbox',{name:'跟随全站壁纸刷新',exact:true}).check();await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await other.reload();await expect(other.getByTestId('custom-background-image')).toHaveAttribute('src',/image\/bbbbbb/);expect(await alpha(other,'.site-header')).toBeCloseTo(.55,2);
 }finally{await ctx.close();}
});
