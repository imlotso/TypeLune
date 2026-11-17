import { chooseTheme } from './appearance';
import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const dir='docs/qa/screenshots/2026-11-16-expanded-hands';
test('expanded chapters and bilingual hands fit desktop/mobile',async({page})=>{
 mkdirSync(dir,{recursive:true});await page.setViewportSize({width:1440,height:1000});await page.goto('/lessons');
 await expect(page.getByText('练习 0 / 5').first()).toBeVisible();await page.screenshot({path:dir+'/course-zh.png',fullPage:true});
 await page.getByRole('button',{name:'进入第一课',exact:true}).click();await expect(page.locator('.guide-hands')).toBeVisible();
 await page.screenshot({path:dir+'/practice-zh.png',fullPage:true});
 await page.getByRole('button',{name:'界面语言：中文，切换为 English'}).click();await expect(page.getByRole('checkbox',{name:'Hands',exact:true})).toBeChecked();
 await page.screenshot({path:dir+'/practice-en.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await chooseTheme(page, 'dark');await page.screenshot({path:dir+'/mobile-en-dark.png',fullPage:true});
 await page.getByRole('checkbox',{name:'Reduce motion'}).check();await expect(page.locator('.finger-guide-static')).toBeVisible();
 await page.getByRole('checkbox',{name:'Hands',exact:true}).uncheck();await expect(page.locator('.guide-hands')).toHaveCount(0);
});
