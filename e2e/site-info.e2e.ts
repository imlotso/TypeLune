import { expect, test } from './fixtures';

test('keeps footer controls above the fixed wallpaper in desktop and mobile layouts', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cloudtyping.theme.v1', 'dark'));
  await page.route('**/api/site/wallpaper?*', route => route.fulfill({ json: {
    enabled: true,
    serverTime: Date.now(),
    background: {
      image: 'https://w.wallhaven.cc/full/aa/wallhaven-aaaaaa.jpg', name: 'Test wallpaper', width: 2560, height: 1440,
      fit: 'cover', positionX: 50, positionY: 50, blur: 0, shade: 0,
    },
  } }));
  await page.route('**/api/wallpapers/image/**', route => route.fulfill({ path: 'public/assets/lake-default.webp', contentType: 'image/webp' }));
  await page.goto('/');
  await expect(page.getByTestId('custom-background-image')).toBeVisible();

  const footer = page.getByRole('contentinfo');
  const help = footer.getByRole('button', { name: '使用帮助', exact: true });
  for (const viewport of [{ width: 1440, height: 940 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await footer.scrollIntoViewIfNeeded();
    await expect(help).toBeEnabled();
    const isAboveWallpaper = await help.evaluate(button => {
      const wallpaper = document.querySelector<HTMLElement>('.custom-background')!;
      // Let hit-testing include the painted wallpaper without changing its stacking order.
      wallpaper.style.pointerEvents = 'auto';
      try {
        const { x, y, width, height } = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(x + width / 2, y + height / 2));
      } finally {
        wallpaper.style.removeProperty('pointer-events');
      }
    });
    expect(isAboveWallpaper).toBe(true);
  }
  await help.click();
  await expect(page.getByRole('heading', { name: '使用帮助', exact: true })).toBeVisible();
});

test('opens help and policy content without losing an active practice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '自定义文字' }).click();
  await page.getByRole('textbox', { name: '自定义文章内容' }).fill('甲乙丙丁');
  await page.getByRole('button', { name: '使用这段文字' }).click();
  await page.getByRole('textbox', { name: '当前行输入' }).fill('甲乙');
  await page.getByRole('button', { name: '使用帮助' }).click();
  await expect(page.getByRole('heading', { name: '使用帮助' })).toBeVisible();
  await expect(page.getByText(/首次输入/)).toBeVisible();
  await expect(page.getByText(/WPM/)).toBeVisible();
  await page.getByRole('button', { name: '隐私政策' }).click();
  await expect(page.getByRole('heading', { name: '隐私政策' })).toBeVisible();
  await expect(page.getByText(/反馈截图/)).toBeVisible();
  await expect(page.getByText('版本：1.0 · 生效日期：2026-11-15')).toBeVisible();
  await page.getByRole('button', { name: '关于与联系' }).click();
  await expect(page.getByText('运营主体：www.sitetalk.net')).toBeVisible();
  await expect(page.getByRole('link', { name: 'admin@imlotso.com' })).toHaveAttribute('href', 'mailto:admin@imlotso.com');
  await page.getByRole('button', { name: '服务条款' }).click();
  await expect(page.getByRole('heading', { name: '服务条款' })).toBeVisible();
  await page.getByRole('link', { name: 'TypeLune 首页' }).click();
  await expect(page.getByTestId('typed-count')).toHaveText('2');
  await expect(page.getByRole('button', { name: '继续练习' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
