import {wallpaperImageSource} from '../src/lib/wallpaper-image';
import sharp from 'sharp';
import { expect, test } from './fixtures';

async function fixture(color: string, day = new Date().toISOString().slice(0, 10)) {
  const { data, info } = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: color } }).webp().toBuffer({ resolveWithObject: true });
  return { image: 'https://w.wallhaven.cc/full/ab/wallhaven-ab12cd.webp', name: 'Wallhaven test', width: info.width, height: info.height, fit: 'cover', positionX: 50, positionY: 50, blur: 0, shade: 25,
    daily: { id: 'ab12cd', day, kind: 'nature', resolution: '1280x720' } };
}
test.beforeEach(async({page})=>{await page.route('**/api/wallpapers/image/**',route=>route.fulfill({path:'public/assets/lake-default.webp',contentType:'image/webp'}));});
async function openBackground(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '外观', exact: true }).click();
  await page.getByRole('button', { name: '日间背景图', exact: true }).click();
  await page.getByRole('checkbox',{name:'跟随全站壁纸刷新',exact:true}).uncheck();
}
for (const trigger of ['manual', 'automatic'] as const) {
  test(`a slow daily wallpaper succeeds through the ${trigger} control`, async ({ page }) => {
    test.setTimeout(45_000);
    const background = await fixture('#60758d');
    await page.route('**/api/wallpapers/daily?*', async route => {
      await new Promise(resolve => setTimeout(resolve, 13_000));
      await route.fulfill({ json: { background } });
    });
    await openBackground(page);
    if (trigger === 'manual') await page.getByRole('button', { name: '获取今日壁纸', exact: true }).click();
    else await page.getByRole('checkbox', { name: '每日自动更新壁纸' }).check();
    await expect(page.getByRole('link', { name: '图片来源：Wallhaven ↗' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByTestId('custom-background-image')).toHaveAttribute('src', wallpaperImageSource(background.image));
    await page.reload();
    await expect(page.getByTestId('custom-background-image')).toHaveAttribute('src', wallpaperImageSource(background.image));
  });
}
test('an enabled daily updater retains the old image while a slow next-day image loads', async ({ page }) => {
  test.setTimeout(45_000);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const old = await fixture('#60758d', yesterday); const today = await fixture('#89759f'); let requests = 0;
  await page.route('**/api/wallpapers/daily?*', async route => {
    if (++requests === 1) return route.fulfill({ json: { background: old } });
    await new Promise(resolve => setTimeout(resolve, 13_000));
    await route.fulfill({ json: { background: today } });
  });
  await openBackground(page);
  await page.getByRole('checkbox', { name: '每日自动更新壁纸' }).check();
  await expect(page.getByRole('link', { name: '图片来源：Wallhaven ↗' })).toBeVisible();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByTestId('custom-background-image')).toHaveAttribute('src', wallpaperImageSource(old.image));
  await expect(page.getByTestId('custom-background-image')).toHaveAttribute('src', wallpaperImageSource(today.image), { timeout: 20_000 });
  await page.reload();
  await expect(page.getByTestId('custom-background-image')).toHaveAttribute('src', wallpaperImageSource(today.image));
});
