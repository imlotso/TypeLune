import {test,expect} from './fixtures';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const shots=join(tmpdir(),'typelune-ui-review');
test('defaults ranking filters to all and retains each specific stage',async({page})=>{
 await page.goto('/rankings?tl=zh-CN');const difficulty=page.getByRole('group',{name:'难度',exact:true}),period=page.getByRole('group',{name:'排行时段',exact:true});
 await expect(difficulty.getByRole('button',{name:'全部',exact:true})).toHaveAttribute('aria-pressed','true');await expect(period.getByRole('button',{name:'全部',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const name of ['入门','进阶','挑战']){await difficulty.getByRole('button',{name,exact:true}).click();await expect(difficulty.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');}
 await difficulty.getByRole('button',{name:'全部',exact:true}).click();mkdirSync(shots,{recursive:true});await page.screenshot({path:shots+'/ranking-all.png'});
 await page.goto('/rankings?difficulty=advanced&period=week&tl=zh-CN');await expect(difficulty.getByRole('button',{name:'挑战',exact:true})).toHaveAttribute('aria-pressed','true');await expect(period.getByRole('button',{name:'近7天',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('mobile feedback can close without losing its draft and themes are icon-only',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/feedback?tl=zh-CN');await page.getByLabel('标题',{exact:true}).fill('暂存的反馈');await page.getByLabel('详细描述',{exact:true}).fill('关闭后继续填写');await expect(page.getByRole('button',{name:'关闭功能反馈',exact:true})).toBeInViewport();mkdirSync(shots,{recursive:true});await page.screenshot({path:shots+'/feedback-close.png',fullPage:true});await page.getByRole('button',{name:'关闭功能反馈',exact:true}).click();expect(new URL(page.url()).pathname).toBe('/');
 await page.getByRole('button',{name:'功能反馈',exact:true}).click();await expect(page.getByLabel('标题',{exact:true})).toHaveValue('暂存的反馈');await page.getByRole('link',{name:'TypeLune 首页',exact:true}).click();expect(new URL(page.url()).pathname).toBe('/');
 await page.getByRole('button',{name:'外观',exact:true}).click();const dialog=page.getByRole('dialog',{name:'外观',exact:true});for(const name of ['日间','夜间']){const button=dialog.getByRole('button',{name,exact:true});expect(await button.textContent()).toBe('');await button.click();}await page.screenshot({path:shots+'/theme-icons.png'});
});
