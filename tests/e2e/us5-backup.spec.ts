import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { cell, closeSheet, createBoard, disableWebShare, fillCell, fixturePath } from "./helpers";

test.beforeEach(async ({ page }) => {
  await disableWebShare(page);
});

test("US5: switch boards, back up, delete, restore; a broken file changes nothing", async ({
  page,
}, info) => {
  await createBoard(page, "北海道旅行", "3×4");
  await fillCell(page, 1, 1, "ジンギスカン", "食べたい");
  await page.getByLabel("ライブラリから選ぶ").setInputFiles(fixturePath("gps-photo.jpg"));
  await expect(page.getByRole("button", { name: "表示範囲を調整" })).toBeVisible();
  await closeSheet(page);
  await page.getByRole("button", { name: "ボード一覧へ" }).click();

  await createBoard(page, "2026年やりたいこと", "5×5");
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await expect(page.locator(".board-item")).toHaveCount(2);
  await expect(page.getByText("バックアップをおすすめします")).toBeVisible();

  // switch between boards
  await page.getByRole("button", { name: /^北海道旅行/ }).click();
  await expect(cell(page, 1, 1)).toHaveAttribute("aria-label", /ジンギスカン 達成済み/);
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await page.getByRole("button", { name: /^2026年やりたいこと/ }).click();
  await expect(page.locator(".grid-cell")).toHaveCount(25);
  await page.getByRole("button", { name: "ボード一覧へ" }).click();

  // back up everything
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "バックアップを書き出す" }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^photo-bucket-\d{8}-\d{4}\.photobucket\.json$/);
  const backupPath = info.outputPath("backup.photobucket.json");
  writeFileSync(backupPath, readFileSync((await download.path())!));

  // the list has no delete buttons; delete one board from its settings (FR-023)
  await expect(page.getByRole("button", { name: /を削除$/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^北海道旅行/ }).click();
  await page.getByRole("button", { name: "ボードの設定" }).click();
  await page.getByRole("button", { name: "このボードを削除" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("写真 1 枚");
  await page.getByRole("alertdialog").getByRole("button", { name: "削除" }).click();
  await expect(page.locator(".board-item")).toHaveCount(1);

  // restore
  await page.getByLabel("バックアップを読み込む").setInputFiles(backupPath);
  // "2026年やりたいこと" still exists: keep it and add the backup as a copy
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("「2026年やりたいこと」はすでにあります");
  await dialog.getByRole("button", { name: "別のボードとして追加" }).click();
  await expect(page.getByText("2 件のボードを読み込みました")).toBeVisible();
  await expect(page.locator(".board-item")).toHaveCount(3);
  await page.getByRole("button", { name: /^北海道旅行/ }).click();
  await expect(cell(page, 1, 1)).toHaveAttribute("aria-label", /ジンギスカン 達成済み/);
  await expect(cell(page, 1, 1).locator("img")).toBeVisible();
  await page.getByRole("button", { name: "ボード一覧へ" }).click();

  // broken file
  const broken = info.outputPath("broken.photobucket.json");
  writeFileSync(
    broken,
    '{"format":"photo-bucket-backup","formatVersion":1,"boards":[{"id":1}],"photos":[]}',
  );
  await page.getByLabel("バックアップを読み込む").setInputFiles(broken);
  await expect(page.getByText("ファイルの内容に誤りがあります")).toBeVisible();
  await expect(page.locator(".board-item")).toHaveCount(3);
});

test("US5: delete a board from its settings", async ({ page }) => {
  await createBoard(page, "消すボード", "3×3");
  await page.getByRole("button", { name: "ボードの設定" }).click();
  await page.getByRole("button", { name: "このボードを削除" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "削除" }).click();
  await expect(page.getByRole("button", { name: "最初のボードを作る" })).toBeVisible();
});
