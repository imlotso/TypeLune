import { test, expect } from '@playwright/test';
import { assessmentArticle } from '../src/lib/assessment';
test('personal baseline and real mistake drill stay unranked',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('typelune.ui-locale.v1','en'));
 await page.goto('/lessons');
 await expect(page.getByText('No recorded English key errors yet.')).toBeVisible();
 await page.getByRole('button',{name:'Open baseline',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Current line input',exact:true});
 await expect(input).toBeEnabled();
 await input.fill('x'+assessmentArticle('en').text.slice(1));
 await expect(page.getByRole('dialog',{name:'Practice results'})).toBeVisible();
 await expect(page.getByRole('button',{name:/Submit.*leaderboard/i})).toHaveCount(0);
 await page.goto('/lessons');
 await expect(page.getByRole('button',{name:'Open retest',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Practice these keys',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Weak-key practice',exact:true})).toBeVisible();
});
