import { test, expect } from './fixtures';

test('resume waits for committed input, including Chinese IME, without starting either clock', async ({ page }) => {
  let resumes = 0;
  page.on('request', request => { if (/\/api\/tests\/[^/]+\/resume$/.test(request.url())) resumes++; });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: '当前行输入' });
  await input.fill('我');
  await expect(page.getByRole('button', { name: '暂停练习' })).toBeVisible();
  await page.getByRole('button', { name: '暂停练习' }).click();
  await page.getByRole('button', { name: '继续练习' }).click();
  await expect(input).toBeEnabled();
  const remaining = await page.getByTestId('remaining-time').textContent();
  await input.focus();
  await input.press('ArrowLeft');
  await input.press('Shift');
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('remaining-time')).toHaveText(remaining!);
  expect(resumes).toBe(0);
  await input.dispatchEvent('compositionstart');
  await input.evaluate((element: HTMLTextAreaElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(element, '我ni');
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', isComposing: true, data: 'ni' }));
  });
  await page.waitForTimeout(1100);
  await expect(page.getByTestId('remaining-time')).toHaveText(remaining!);
  expect(resumes).toBe(0);
  await input.evaluate((element: HTMLTextAreaElement) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(element, '我你');
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你' }));
  });
  await expect(page.getByRole('button', { name: '暂停练习' })).toBeVisible();
  await expect(input).toHaveValue('我你');
  expect(resumes).toBe(1);
  await expect.poll(async () => await page.getByTestId('remaining-time').textContent()).not.toBe(remaining);
});
