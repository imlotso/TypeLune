import { test, expect } from '@playwright/test';
test.describe('English interface',()=>{
 test.use({locale:'en-US'});
 test('detects browser locale and switches without losing practice input',async({page})=>{
  await page.goto('/'); await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  const input=page.getByRole('textbox',{name:'Current line input'}); await expect(input).toBeEnabled(); await input.fill('test');
  await page.getByRole('button',{name:'Interface language: English. Switch to 中文'}).click();
  await expect(page.getByRole('textbox',{name:'当前行输入'})).toHaveValue('test');
  await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
  await page.reload(); await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
 });
 test('keeps practice language separate and exposes both background editors',async({page})=>{
  await page.goto('/'); const group=page.getByRole('group',{name:'Practice language'}); await expect(group.getByRole('button',{name:'Chinese',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Appearance',exact:true}).click();
  await expect(page.getByRole('button',{name:'Light background',exact:true})).toBeVisible(); await page.getByRole('button',{name:'Dark background',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Dark mode background',exact:true})).toBeVisible();
 });
});
test.describe('Chinese browser',()=>{test.use({locale:'zh-TW'});test('uses Chinese interface',async({page})=>{await page.goto('/');await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');});});
