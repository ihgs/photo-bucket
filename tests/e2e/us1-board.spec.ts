import { expect, test } from "@playwright/test";
import { cell, closeSheet, createBoard, fillCell } from "./helpers";

test("US1: create a 3×4 board, write items, and keep them after reload", async ({ page }) => {
  await page.goto("./");
  // With no boards, the list shows a 4-step guide (FR-028)
  await expect(page.getByRole("heading", { name: "使い方" })).toBeVisible();
  await expect(page.locator(".usage").getByRole("listitem")).toHaveText([
    "ボードを作る",
    "マスにやりたいことを書く",
    "達成したら写真を貼る",
    "全マス達成したら一枚の画像として保存・共有する",
  ]);
  await page.getByRole("button", { name: "最初のボードを作る" }).click();
  await expect(page.getByRole("heading", { name: "新しいボード" })).toBeVisible();
  await createBoard(page, "京都旅行", "3×4");

  const cells = page.locator(".grid-cell");
  await expect(cells).toHaveCount(12);
  const box = (await page.locator(".grid").boundingBox())!;
  expect(box.height / box.width).toBeCloseTo(4 / 3, 2);
  // 3 columns: the 4th cell starts a new row
  const c3 = (await cells.nth(2).boundingBox())!;
  const c4 = (await cells.nth(3).boundingBox())!;
  expect(c4.y).toBeGreaterThan(c3.y);
  // no horizontal scroll (FR-026)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await fillCell(page, 1, 3, "京都で抹茶パフェを食べる", "食べたい");
  await closeSheet(page);
  await expect(cell(page, 1, 3)).toContainText("食べたい");
  await expect(cell(page, 1, 3)).toHaveAttribute(
    "aria-label",
    "1行3列 京都で抹茶パフェを食べる 未達成",
  );
  await expect(page.getByText("0/12 達成")).toBeVisible();

  await page.reload();
  await expect(cell(page, 1, 3)).toHaveAttribute("aria-label", /京都で抹茶パフェを食べる/);

  // Launching the app again reopens the last board once; the list stays reachable afterwards.
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "京都旅行" })).toBeVisible();
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await expect(page.getByRole("button", { name: /^京都旅行/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "使い方" })).toHaveCount(0);
  await page.getByRole("button", { name: /^京都旅行/ }).click();

  // an existing item opens read-only; the pencil button opens the form
  await cell(page, 1, 3).click();
  await expect(page.getByRole("dialog")).toContainText("京都で抹茶パフェを食べる");
  await expect(page.getByLabel("やりたいこと", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "やりたいこととカテゴリを編集" }).click();
  await page.getByLabel("やりたいこと", { exact: true }).fill("京都で抹茶パフェを2杯食べる");
  await page.getByRole("button", { name: "完了" }).click();
  await expect(page.getByRole("dialog")).toContainText("京都で抹茶パフェを2杯食べる");
  await expect(cell(page, 1, 3)).toHaveAttribute("aria-label", /京都で抹茶パフェを2杯食べる/);

  // delete the item
  await page.getByRole("button", { name: "やりたいこととカテゴリを編集" }).click();
  await page.getByRole("button", { name: "項目を削除" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "削除" }).click();
  await expect(cell(page, 1, 3)).toHaveAttribute("aria-label", "1行3列 空きマス");
});

test("US1: 5×5 board, move mode swaps cells, resizing warns before deleting", async ({ page }) => {
  await createBoard(page, "やりたいこと", "5×5");
  await expect(page.locator(".grid-cell")).toHaveCount(25);
  await fillCell(page, 1, 1, "富士山に登る", "行きたい");
  await closeSheet(page);
  await fillCell(page, 5, 5, "オーロラを見る");
  await closeSheet(page);

  await page.getByRole("button", { name: "移動" }).click();
  await cell(page, 1, 1).click();
  await cell(page, 2, 2).click();
  await page.getByRole("button", { name: "完了" }).click();
  await expect(cell(page, 2, 2)).toHaveAttribute("aria-label", /富士山に登る/);
  await expect(cell(page, 1, 1)).toHaveAttribute("aria-label", "1行1列 空きマス");

  await page.getByRole("button", { name: "ボードの設定" }).click();
  await page.getByRole("radio", { name: /^3×3/ }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("1 件の項目");
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.getByText("現在 5×5")).toBeVisible();
  await page.getByRole("radio", { name: /^3×3/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "変更して削除" }).click();
  await expect(page.getByText("現在 3×3")).toBeVisible();
  await page.getByRole("button", { name: "ボードへ戻る" }).click();
  await expect(page.locator(".grid-cell")).toHaveCount(9);
  await expect(cell(page, 2, 2)).toHaveAttribute("aria-label", /富士山に登る/);
});
