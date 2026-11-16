import { test, expect } from './fixtures';
import type { APIRequestContext } from '@playwright/test';
import { assessmentArticle } from '../src/lib/assessment';
import { mkdirSync } from 'node:fs';

// Signed-in accounts without a preference follow the browser, not the guest key.
test.use({ locale: 'en-US' });
test('personal baseline and real mistake drill stay unranked',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('typelune.ui-locale.v1','en'));
 await page.goto('/lessons');
 await expect(page.getByText('No recorded English key errors yet.')).toBeVisible();
 await page.getByRole('button',{name:'More',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 const settings=page.getByRole('dialog',{name:'Practice settings',exact:true});
 await settings.getByRole('combobox',{name:'Practice mode',exact:true}).selectOption('timed');
 const strict=settings.getByRole('checkbox',{name:'Strict correction',exact:true});
 await expect(strict).not.toBeChecked();
 // The controlled setting updates after its IndexedDB write commits. Click
 // once, then assert the actual saved UI state instead of check()'s immediate
 // post-click assumption. Reload persistence is still asserted below.
 await strict.click();
 await expect(strict).toBeChecked();
 await settings.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Open baseline',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Current line input',exact:true});
 await expect(input).toBeEnabled();
 await input.fill('x');
 await page.waitForTimeout(1200);
 await input.fill('x'+assessmentArticle('en').text.slice(1));
 await expect(page.getByRole('dialog',{name:'Practice result',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Submit.*leaderboard/i})).toHaveCount(0);
 await page.getByRole('button',{name:'Course outline',exact:true}).last().click();
 await expect(page.getByRole('button',{name:'Open retest',exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('button',{name:'Open retest',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'More',exact:true}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(settings.getByRole('combobox',{name:'Practice mode',exact:true})).toHaveValue('timed');
 await expect(settings.getByLabel('Strict correction',{exact:true})).toBeChecked();
 await settings.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Open retest',exact:true}).click();
 await input.fill('T'); await page.waitForTimeout(1200); await input.fill(assessmentArticle('en').text);
 await expect(page.getByRole('dialog',{name:'Practice result',exact:true})).toBeVisible();
 await expect(page.getByRole('dialog').getByText('Latest',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Course outline',exact:true}).last().click();
 await page.getByRole('button',{name:'Practice these keys',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Weak-key practice',exact:true})).toBeVisible();
 mkdirSync('docs/qa/screenshots/2026-11-16-lessons',{recursive:true});
 await page.screenshot({path:'docs/qa/screenshots/2026-11-16-lessons/desktop-weak-key-en.png',fullPage:true});
});

async function register(request: APIRequestContext,username:string) {
 const email=username+'@example.test';
 expect((await request.post('/api/auth/code',{data:{email,purpose:'register'}})).ok()).toBe(true);
 const code=(await(await request.get(`/__e2e__/email-code?email=${email}&purpose=register`)).json()).code;
 expect((await request.post('/api/auth/register',{data:{email,username,password:'assessment-test-password',code}})).ok()).toBe(true);
}
test('assessment and weak-key progress never leak between signed-in identities',async({page})=>{
 await register(page.request,'assessment_first');
 await page.addInitScript(()=>localStorage.setItem('typelune.ui-locale.v1','en'));
 await page.goto('/lessons');
 await page.getByRole('button',{name:'Open baseline',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Current line input',exact:true});
 await input.fill('x');await page.waitForTimeout(1200);await input.fill('x'+assessmentArticle('en').text.slice(1));
 await expect(page.getByRole('dialog',{name:'Practice result',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Course outline',exact:true}).last().click();
 await expect(page.getByRole('button',{name:'Open retest',exact:true})).toBeVisible();
 expect((await page.request.post('/api/auth/logout',{data:{}})).ok()).toBe(true);
 await register(page.request,'assessment_second');
 await page.reload();
 await expect(page.getByRole('button',{name:'assessment_second',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open baseline',exact:true})).toBeVisible();
 await expect(page.getByText('No recorded English key errors yet.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Practice these keys',exact:true})).toHaveCount(0);
});
