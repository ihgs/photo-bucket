import { expect, test } from "@playwright/test";
import {
  closeSheet,
  createBoard,
  disableWebShare,
  fillCell,
  fixturePath,
  openExport,
} from "./helpers";

// Service workers are not available in Playwright's WebKit.
test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

test("US4: the manifest is served under the sub path", async ({ request }) => {
  const res = await request.get("manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.start_url).toBe("/photo-bucket/");
  expect(manifest.scope).toBe("/photo-bucket/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.lang).toBe("ja");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
});

test("US4: everything works offline after the first visit (SC-005)", async ({ page, context }) => {
  await disableWebShare(page);
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("オフラインです（すべての機能を使えます）")).toBeVisible();

  await createBoard(page, "オフライン", "4×3");
  await fillCell(page, 1, 1, "海で泳ぐ", "やりたい");
  await page.getByLabel("ライブラリから選ぶ").setInputFiles(fixturePath("landscape.jpg"));
  await expect(page.getByRole("button", { name: "表示範囲を調整" })).toBeVisible();
  await closeSheet(page);
  await expect(page.getByText("1/12 達成")).toBeVisible();

  await openExport(page);
  await expect(page.locator("img.export-preview")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "画像を保存・共有" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^オフライン-\d{8}\.jpg$/);
});
