import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  closeSheet,
  createBoard,
  disableWebShare,
  fillCell,
  fixturePath,
  openExport,
} from "./helpers";

const check = async (page: Page, name: string) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious.map((v) => `${name}: ${v.id} ${v.help} (${v.nodes.length})`)).toEqual([]);
};

test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

test("no serious accessibility violations on any screen", async ({ page }) => {
  await disableWebShare(page);
  await page.goto("./");
  await expect(page.getByRole("button", { name: "最初のボードを作る" })).toBeVisible();
  await check(page, "empty list");

  await page.goto("./#/new");
  await check(page, "new board");
  await createBoard(page, "アクセシビリティ", "3×4");
  await fillCell(page, 1, 1, "海で泳ぐ", "行きたい");
  await check(page, "cell sheet");
  await page.getByLabel("ライブラリから選ぶ").setInputFiles(fixturePath("landscape.jpg"));
  await expect(page.getByRole("button", { name: "表示範囲を調整" })).toBeVisible();
  await check(page, "cell sheet with photo");
  await page.getByRole("button", { name: "表示範囲を調整" }).click();
  await expect(page.locator(".crop-frame img")).toBeVisible();
  await check(page, "crop editor");
  await page.getByRole("button", { name: "完了" }).click();
  await closeSheet(page);
  await check(page, "board");

  await openExport(page);
  await expect(page.locator("img.export-preview")).toBeVisible();
  await check(page, "export");
  await page.getByRole("button", { name: "ボードへ戻る" }).click();

  await page.getByRole("button", { name: "ボードの設定" }).click();
  await check(page, "settings");
  await page.getByRole("button", { name: "ボードへ戻る" }).click();
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await expect(page.locator(".board-item")).toHaveCount(1);
  await check(page, "board list");
});
