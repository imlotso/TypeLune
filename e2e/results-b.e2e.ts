import { test, expect, ensureAdmin } from "./fixtures";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const shots =
  process.env.TYPELUNE_DESIGN_SHOTS ??
  join(tmpdir(), "typelune-results-b-shots");
test("shows approved B layout, immutable prefix, tabs and working continuation on desktop and phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?tl=zh-CN");
  const input = page.getByRole("textbox", { name: "当前行输入", exact: true });
  await input.fill("我与父亲不相见");
  await page.waitForTimeout(1300);
  await page.getByRole("button", { name: "结束练习", exact: true }).click();
  await page
    .getByRole("button", { name: "结束并查看成绩", exact: true })
    .click();
  const result = page.getByRole("dialog", { name: "练习成绩", exact: true });
  await expect(result).toBeVisible();
  expect((await result.boundingBox())!.width).toBeGreaterThan(1000);
  const suffix = result.getByRole("textbox", { name: "上榜昵称", exact: true });
  await expect(suffix).toHaveValue("");
  await suffix.fill("小云");
  await expect(result.getByText("visitor小云", { exact: true })).toBeVisible();
  await suffix.fill("");
  await suffix.press("Backspace");
  await expect(
    result.getByLabel("固定前缀 visitor", { exact: true }),
  ).toHaveText("visitor");
  await suffix.fill("1234567890");
  await expect(
    result.getByRole("button", { name: "提交到排行榜", exact: true }),
  ).toBeDisabled();
  await suffix.fill("小云");
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: shots + "/desktop-light.png" });
  await result.getByRole("tab", { name: "过程", exact: true }).click();
  await expect(
    result.getByRole("tabpanel", { name: "过程", exact: true }),
  ).toBeVisible();
  await result.getByRole("tab", { name: "错字", exact: true }).click();
  await expect(
    result.getByRole("tabpanel", { name: "错字", exact: true }),
  ).toBeVisible();
  await result.getByRole("tab", { name: "概览", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(
    result.getByRole("button", { name: "关闭", exact: true }),
  ).toBeInViewport();
  await expect(
    result.getByRole("button", { name: "继续本篇", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: shots + "/desktop-short.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(
    result.getByRole("button", { name: "关闭", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: shots + "/mobile-light.png" });
  await suffix.scrollIntoViewIfNeeded();
  await expect(suffix).toBeInViewport();
  await page.screenshot({ path: shots + "/mobile-nickname.png" });
  await result
    .getByRole("button", { name: "提交到排行榜", exact: true })
    .click();
  await expect(result.getByText("已提交，待复核。")).toBeVisible();
  await result.getByRole("button", { name: "继续本篇", exact: true }).click();
  await expect(page.getByTestId("typed-count")).toHaveText("7");
  await page.getByRole("button", { name: "继续练习", exact: true }).click();
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue("我与父亲不相见");
});
test("admin can inspect both imported packs, add, delete, export and enable selected languages", async ({
  page,
}) => {
  await ensureAdmin(page.request);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin?tab=nicknames&tl=zh-CN");
  const master = page.getByRole("checkbox", {
    name: "启用昵称过滤",
    exact: true,
  });
  await expect(master).not.toBeChecked();
  const zh = page.getByRole("checkbox", { name: "中文词包", exact: true }),
    en = page.getByRole("checkbox", { name: "英文词包", exact: true });
  await expect(zh).not.toBeChecked();
  await expect(en).not.toBeChecked();
  await expect(page.getByText("318 条", { exact: true })).toBeVisible();
  await expect(page.getByText("403 条", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "查看词条", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "添加词条", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "编辑词条", exact: true });
  await edit.getByLabel("词条", { exact: true }).fill("隔离测试词");
  await edit.getByRole("button", { name: "应用词条", exact: true }).click();
  await page.getByLabel("搜索词条", { exact: true }).fill("隔离测试词");
  await expect(
    page.getByRole("button", { name: "删除词条 隔离测试词", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "删除词条 隔离测试词", exact: true })
    .click();
  await expect(page.getByText("没有词条", { exact: true })).toBeVisible();
  await en.check();
  await master.check();
  await page.getByRole("button", { name: "保存昵称设置", exact: true }).click();
  await expect(
    page.getByText("昵称过滤设置已保存", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(master).toBeChecked();
  await expect(en).toBeChecked();
  await page
    .getByRole("button", { name: "查看词条", exact: true })
    .nth(1)
    .click();
  await page.getByLabel("搜索词条", { exact: true }).fill("fuck");
  await expect(
    page.getByRole("button", { name: "删除词条 fuck", exact: true }),
  ).toBeVisible();
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: shots + "/admin-english.png" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(
    "typelune-nicknames-en.json",
  );
  await page.getByRole("button", { name: "批量导入", exact: true }).click();
  const importer = page.getByRole("dialog", {
    name: "批量导入词条",
    exact: true,
  });
  await importer.locator("input[type=file]").setInputFiles({
    name: "terms.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("# test fixture\nimportfixture\nimportfixture\n"),
  });
  await expect(importer.getByRole("status")).toContainText("English 1 条");
  await importer.getByRole("button", { name: "应用导入", exact: true }).click();
  await page.getByLabel("搜索词条", { exact: true }).fill("importfixture");
  await expect(
    page.getByRole("button", { name: "删除词条 importfixture", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "保存昵称设置", exact: true }).click();
  await expect(
    page.getByText("昵称过滤设置已保存", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "查看词条", exact: true })
    .nth(1)
    .click();
  await page.getByLabel("搜索词条", { exact: true }).fill("importfixture");
  await page
    .getByRole("button", { name: "删除词条 importfixture", exact: true })
    .click();
  await master.uncheck();
  await zh.uncheck();
  await en.uncheck();
  await page.getByRole("button", { name: "保存昵称设置", exact: true }).click();
  await expect(
    page.getByText("昵称过滤设置已保存", { exact: true }),
  ).toBeVisible();
});
test("keeps English WPM, CPM and explanation readable in dark mobile results", async ({
  page,
}) => {
  await page.goto("/?tl=en");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Appearance", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Practice language", exact: true })
    .getByRole("button", { name: "English", exact: true })
    .click();
  await page.getByRole("button", { name: "Custom text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Custom article content", exact: true })
    .fill("Clouds move slowly.");
  await page
    .getByRole("button", { name: "Use this text", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Current line input", exact: true })
    .fill("Clouds move slowly.");
  const dialog = page.getByRole("dialog", {
    name: "Practice result",
    exact: true,
  });
  await expect(
    dialog.getByRole("group", { name: "English speed", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".result-article p")).toContainText("English · Custom · Timed 5 min");
  await expect(dialog.locator(".result-article p")).not.toContainText("Beginner");
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog
    .getByRole("button", { name: "About English speed", exact: true })
    .click();
  await expect(
    dialog.getByText("Characters per minute (CPM)", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: shots + "/mobile-dark-english.png" });
});

test("enforces enabled word packs on the server and lets a guest correct a blocked nickname", async ({
  page,
  browser,
  baseURL,
  clientIp,
}) => {
  await ensureAdmin(page.request);
  const original = await (
    await page.request.get("/api/admin/nicknames")
  ).json();
  expect(
    (
      await page.request.post("/api/admin/nicknames", {
        data: {
          revision: original.revision,
          settings: { ...original.settings, enabled: true, languages: ["en"] },
        },
      })
    ).ok(),
  ).toBe(true);
  const guest = await browser.newContext({
    baseURL,
    locale: "zh-CN",
    extraHTTPHeaders: { "X-Forwarded-For": clientIp },
  });
  try {
    const front = await guest.newPage();
    await front.goto("/?tl=zh-CN");
    await front
      .getByRole("textbox", { name: "当前行输入", exact: true })
      .fill("我");
    await front.waitForTimeout(1200);
    await front.getByRole("button", { name: "结束练习", exact: true }).click();
    await front
      .getByRole("button", { name: "结束并查看成绩", exact: true })
      .click();
    const dialog = front.getByRole("dialog", { name: "练习成绩", exact: true }),
      suffix = dialog.getByRole("textbox", { name: "上榜昵称", exact: true });
    await suffix.fill("f.u.c.k");
    await dialog
      .getByRole("button", { name: "提交到排行榜", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "昵称含有不允许使用的词，请更换昵称",
    );
    await expect(suffix).toHaveAttribute("aria-invalid", "true");
    await suffix.fill("小云");
    await expect(suffix).toHaveAttribute("aria-invalid", "false");
    await dialog
      .getByRole("button", { name: "提交到排行榜", exact: true })
      .click();
    await expect(dialog.getByText("已提交，待复核。")).toBeVisible();
  } finally {
    await guest.close();
    const current = await (
      await page.request.get("/api/admin/nicknames")
    ).json();
    expect(
      (
        await page.request.post("/api/admin/nicknames", {
          data: { revision: current.revision, settings: original.settings },
        })
      ).ok(),
    ).toBe(true);
  }
});
