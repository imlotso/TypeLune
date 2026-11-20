import { test, expect, ensureAdmin } from './fixtures';
import { mkdirSync } from 'node:fs';

test('fresh administrator sign-in preserves a shared column and guards browser history',async({page})=>{
 await ensureAdmin(page.request);
 expect((await page.request.post('/api/auth/logout',{data:{}})).ok()).toBe(true);
 await page.goto('/admin?tab=mail');
 const login=page.getByRole('dialog',{name:'登录',exact:true});
 await login.getByLabel('用户名或邮箱').fill('admin@example.test');
 await login.getByLabel('密码',{exact:true}).fill('ci-password-123');
 await login.getByRole('button',{name:'登录',exact:true}).click();
 await expect(page).toHaveURL(/\/admin\?tab=mail$/);
 await expect(page.getByLabel('SMTP 主机',{exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByLabel('SMTP 主机',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'概览',exact:true}).click();
 await page.getByRole('button',{name:'邮件',exact:true}).click();
 await page.getByLabel('SMTP 主机',{exact:true}).fill('smtp.unsaved.example.test');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.goBack();
 await expect(page).toHaveURL(/\/admin\?tab=mail$/);
 await expect(page.getByLabel('SMTP 主机',{exact:true})).toHaveValue('smtp.unsaved.example.test');
 page.once('dialog',dialog=>dialog.accept());
 await page.goBack();
 await expect(page).toHaveURL(/\/admin\?tab=overview$/);
 await page.goForward();
 await expect(page).toHaveURL(/\/admin\?tab=mail$/);
 await expect(page.getByLabel('SMTP 主机',{exact:true})).toHaveValue('');
 mkdirSync('docs/qa/screenshots/2026-11-16-lessons',{recursive:true});
 await page.screenshot({path:'docs/qa/screenshots/2026-11-16-lessons/desktop-admin-mail-zh.png',fullPage:true});
 await page.goto('/admin?tab=support');
 await expect(page.getByLabel('显示捐赠入口')).toBeVisible();
 await page.reload();await expect(page.getByLabel('显示捐赠入口')).toBeVisible();
});

test('centers and styles the admin loading screen while authentication is pending on slow networks', async ({ page }) => {
  await ensureAdmin(page.request);
  let releaseMe!: () => void;
  const mePending = new Promise<void>((resolve) => { releaseMe = resolve; });
  await page.route('**/api/me', async (route) => {
    await mePending;
    await route.continue();
  });
  await page.addInitScript(() => localStorage.setItem('cloudtyping.theme.v1', 'dark'));
  try {
    await page.goto('/admin?tab=overview', { waitUntil: 'domcontentloaded' });
    const status = page.getByRole('status');
    await expect(status).toContainText('正在读取账号…');
    const metrics = await status.evaluate((el) => {
      const style = getComputedStyle(el);
      const icon = el.querySelector('svg')!.getBoundingClientRect();
      return {
        display: style.display,
        justifyContent: style.justifyContent,
        alignItems: style.alignItems,
        centerX: icon.x + icon.width / 2,
        centerY: icon.y + icon.height / 2,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
      };
    });
    expect(metrics.display).toBe('flex');
    expect(metrics.justifyContent).toBe('center');
    expect(metrics.alignItems).toBe('center');
    expect(Math.abs(metrics.centerX - metrics.viewportW / 2)).toBeLessThan(120);
    expect(Math.abs(metrics.centerY - metrics.viewportH / 2)).toBeLessThan(80);
  } finally {
    releaseMe();
    await page.unroute('**/api/me');
  }
  await expect(page.getByRole('button', { name: '概览', exact: true })).toBeVisible();
});
