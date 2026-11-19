import { test, expect } from './fixtures';

test('restores completed rows and resumes an English draft at the saved cursor', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('group', { name: '练习语言', exact: true }).getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: '自定义文字', exact: true }).click();
  await page.getByRole('textbox', { name: '自定义文章内容' }).fill('The story begins.\ndealing with the next chapter.');
  await page.getByRole('button', { name: '使用这段文字' }).click();

  const input = page.getByRole('textbox', { name: '当前行输入', exact: true });
  await input.pressSequentially('The story begins.');
  await input.press('Enter');
  await input.pressSequentially('deal');
  await page.getByRole('button', { name: '结束练习', exact: true }).click();
  await page.getByRole('button', { name: '结束并查看成绩', exact: true }).click();
  await page.getByRole('dialog', { name: '练习成绩', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
  await page.goto('/drafts');
  await page.getByRole('button', { name: '继续《自定义文字》', exact: true }).click();

  await expect(page.getByRole('textbox', { name: '第 1 行输入', exact: true })).toHaveValue('The story begins.\n');
  await expect(input).toHaveValue('deal');
  await page.getByRole('button', { name: '继续练习', exact: true }).click();
  await expect(input).toBeFocused();
  expect(await input.evaluate((field: HTMLTextAreaElement) => field.selectionStart)).toBe(4);
  await input.press('Backspace');
  await expect(input).toHaveValue('deal');
  await expect(page.getByRole('button', { name: '继续练习', exact: true })).toBeVisible();
  await input.pressSequentially('ing');
  await expect(input).toHaveValue('dealing');
  await expect(page.getByTestId('error-count')).toHaveText('0');
  await expect(page.getByTestId('typed-count')).toHaveText('25');

  await input.press('ControlOrMeta+a');
  await input.press('e');
  await expect(input).toHaveValue('deale');
  await input.press('Backspace');
  await expect(input).toHaveValue('deal');
});

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
