import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const shots='docs/qa/screenshots/2026-11-16-lessons';
test('course completes in the shared engine and resumes a partial lesson', async ({page}) => {
  mkdirSync(shots,{recursive:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/lessons');
  await expect(page.getByRole('heading',{name:'新手课程',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'进入第一课'})).toBeEnabled();
  await page.screenshot({path:shots+'/desktop-course-zh.png',fullPage:true});
  await page.getByRole('button',{name:'进入第一课'}).click();
  const input=page.getByRole('textbox',{name:'当前行输入',exact:true});
  await expect(input).toBeEnabled();
  await expect(page.getByRole('region',{name:'课程提示'})).toBeVisible();
  await page.screenshot({path:shots+'/desktop-practice-zh.png',fullPage:true});
  const lessonText='fj fj jf jf ff jj fj jf\nfjf jfj fjf jfj ff jj';
  await input.fill(lessonText);
  await expect(page.getByRole('dialog',{name:'练习成绩'})).toBeVisible();
  await expect(page.getByText('本课完成',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'提交到排行榜'})).toHaveCount(0);
  await page.screenshot({path:shots+'/desktop-result-zh.png',fullPage:true});
  await page.getByRole('button',{name:'下一课',exact:true}).click();
  await expect(page.getByRole('heading',{name:'左右交替',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'当前行输入',exact:true}).fill('f j');
  await page.getByRole('button',{name:'课程目录',exact:true}).click();
  await expect(page).toHaveURL(/\/lessons$/);
  await expect(page.getByText('1 / 8',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'继续上次练习'}).click();
  await expect(page.getByRole('heading',{name:'左右交替',exact:true})).toBeVisible();
  const resume=page.getByRole('button',{name:'继续练习',exact:true});
  if(await resume.isVisible()) await resume.click();
  await expect(page.getByRole('textbox',{name:'当前行输入',exact:true})).toHaveValue('f j');
  await page.getByRole('button',{name:'界面语言：中文，切换为 English'}).click();
  await expect(page.getByRole('textbox',{name:'Current line input',exact:true})).toHaveValue('f j');
  await expect(page.getByRole('heading',{name:'Alternating hands',exact:true})).toBeVisible();
});
test('mobile English course and practice remain within the viewport in night mode',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('typelune.ui-locale.v1','en'));
  await page.goto('/lessons');
  await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByRole('heading',{name:'Beginner course',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:shots+'/mobile-course-en-dark.png',fullPage:true});
  await page.getByRole('button',{name:'Open first lesson'}).click();
  await expect(page.getByRole('checkbox',{name:'Key hints'})).toBeChecked();
  await page.screenshot({path:shots+'/mobile-practice-en-dark.png',fullPage:true});
  await page.getByRole('checkbox',{name:'Key hints'}).uncheck();
  await expect(page.getByText('Left index',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Course outline',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Beginner course',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'SiteTalk'})).toHaveAttribute('href','https://www.sitetalk.net');
  await expect(page.getByRole('button',{name:'Support TypeLune',exact:true})).toHaveCount(0);
});

for (const [title, text] of [
  ['全字母巩固', 'a quick brown fox jumps\nwe visit a quiet garden\nsix zebras walk beyond the lake\nmy fingers find their way home'],
  ['综合小测', 'Today is a good day to learn something new.\nAt 09:30, we begin a short practice session.\n"Stay calm," says Luna. "Aim for 95% accuracy."\nCan you finish with a steady rhythm?'],
]) {
  test(`offers a phase retest after expanded milestone ${title}`, async ({ page }) => {
    await page.goto('/lessons');
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: '当前行输入', exact: true }).fill(text);
    await expect(page.getByRole('dialog', { name: '练习成绩' })).toBeVisible();
    await expect(page.getByRole('button', { name: '阶段复测', exact: true })).toBeVisible();
  });
}