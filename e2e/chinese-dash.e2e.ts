import { expect, test } from './fixtures';

test('Chinese IME em dashes match Xiang Fei without a false mismatch or offset', async ({page}) => {
  await page.goto('/articles/zh-intermediate-6');
  const detail = page.locator('.public-article');
  await expect(detail.getByRole('heading', { name: '想飞', exact: true })).toBeVisible();
  await expect(detail.locator('.public-article-text')).toContainText('假如这时候窗子外有雪——街上，');
  await detail.getByRole('button', {name:'练习',exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '想飞', exact: true })).toBeVisible();
  const input=page.getByRole('textbox',{name:'当前行输入'});
  await expect(input).toBeEnabled();
  const prefix='假如这时候窗子外有雪';
  await input.fill(prefix);
  await input.evaluate((field,prefix)=>{
    const target=field as HTMLTextAreaElement;
    target.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!;
    setter.call(target,prefix+'——');
    target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'——',isComposing:true}));
    target.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'——'}));
  },prefix);
  await expect(input).toHaveValue(prefix+'——');
  await expect(page.locator('.char-wrong')).toHaveCount(0);
  await input.fill(prefix+'——街上，');
  await expect(page.locator('.char-wrong')).toHaveCount(0);
  await expect(page.getByTestId('typed-count')).toHaveText(String((prefix+'——街上，').length));
  await page.screenshot({path:'docs/qa/screenshots/dash-corrected-desktop.png',fullPage:true});
});
