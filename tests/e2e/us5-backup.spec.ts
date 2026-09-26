import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { cell, closeSheet, createBoard, disableWebShare, fillCell, fixturePath } from "./helpers";

test.beforeEach(async ({ page }) => {
  await disableWebShare(page);
});

/** On the export screen: writes the selected boards and saves the file at `path`. */
const exportSelected = async (page: Page, path: string) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "書き出す", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^photo-bucket-\d{8}-\d{4}\.pbz$/);
  writeFileSync(path, readFileSync((await download.path())!));
  return path;
};

/** Backs up every board (10 or fewer) from the board list and saves the file at `path`. */
const exportAll = async (page: Page, path: string) => {
  await page.getByRole("button", { name: "バックアップを書き出す" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "バックアップを書き出す" }),
  ).toBeVisible();
  await exportSelected(page, path);
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  return path;
};

const checkbox = (page: Page, title: string) =>
  page.getByRole("checkbox", { name: new RegExp(`^${title} `) });

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
  const backupPath = await exportAll(page, info.outputPath("backup.pbz"));
  await expect(page.getByText("バックアップをおすすめします")).toHaveCount(0);

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
  // "2026年やりたいこと" still exists: keep it and add the backup as a copy (one choice for all)
  const dialog = page.getByRole("dialog", { name: "バックアップを読み込む" });
  await expect(dialog).toContainText("合計 2 ボード");
  await dialog.getByRole("radio", { name: "別のボードとして追加する" }).check();
  await dialog.getByRole("button", { name: "読み込む" }).click();
  const done = page.getByRole("dialog", { name: "読み込みが終わりました" });
  await expect(done).toContainText("追加 1 ボード");
  await expect(done).toContainText("別のボードとして追加 1 ボード");
  await done.getByRole("button", { name: "閉じる" }).click();
  await expect(page.locator(".board-item")).toHaveCount(3);
  await page.getByRole("button", { name: /^北海道旅行/ }).click();
  await expect(cell(page, 1, 1)).toHaveAttribute("aria-label", /ジンギスカン 達成済み/);
  await expect(cell(page, 1, 1).locator("img")).toBeVisible();
  await page.getByRole("button", { name: "ボード一覧へ" }).click();

  // broken file
  const broken = info.outputPath("broken.pbz");
  writeFileSync(
    broken,
    '{"format":"photo-bucket-backup","formatVersion":1,"boards":[],"photos":[]}',
  );
  await page.getByLabel("バックアップを読み込む").setInputFiles(broken);
  await expect(
    page.getByText(
      "バックアップファイルを読み込めませんでした（ファイルが壊れている可能性があります）",
    ),
  ).toBeVisible();
  await expect(page.locator(".board-item")).toHaveCount(3);
});

test("US5: delete a board from its settings", async ({ page }) => {
  await createBoard(page, "消すボード", "3×3");
  await page.getByRole("button", { name: "ボードの設定" }).click();
  await page.getByRole("button", { name: "このボードを削除" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "削除" }).click();
  await expect(page.getByRole("button", { name: "最初のボードを作る" })).toBeVisible();
  // Deleting the last board brings the guide back (FR-028)
  await expect(page.getByRole("heading", { name: "使い方" })).toBeVisible();
});

test("US5: replace everything with a backup, or overwrite with one choice", async ({
  page,
}, info) => {
  await createBoard(page, "ボードA", "3×3");
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await createBoard(page, "ボードB", "3×3");
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  const backupPath = await exportAll(page, info.outputPath("ab.pbz"));

  await createBoard(page, "あとで作った", "3×3");
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await expect(page.locator(".board-item")).toHaveCount(3);

  // replace: one confirmation with the counts, then the list equals the backup
  await page.getByLabel("バックアップを読み込む").setInputFiles(backupPath);
  const dialog = page.getByRole("dialog", { name: "バックアップを読み込む" });
  await dialog.getByRole("radio", { name: "すべて置き換える" }).check();
  await dialog.getByRole("button", { name: "読み込む" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(
    "端末にある 1 個のボードを削除し、バックアップの 2 個のボードに置き換えます",
  );
  await confirm.getByRole("button", { name: "置き換える" }).click();
  const done = page.getByRole("dialog", { name: "読み込みが終わりました" });
  await expect(done).toContainText("上書き 2 ボード");
  await done.getByRole("button", { name: "閉じる" }).click();
  await expect(page.locator(".board-item")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^あとで作った/ })).toHaveCount(0);

  // add + overwrite: no per-board questions
  await page.getByLabel("バックアップを読み込む").setInputFiles(backupPath);
  await dialog.getByRole("radio", { name: "上書きする" }).check();
  await dialog.getByRole("button", { name: "読み込む" }).click();
  await expect(done).toContainText("上書き 2 ボード");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("US3: choose boards to export, with sizes and export state", async ({ page }, info) => {
  for (const title of ["東京", "大阪", "京都", "奈良"]) {
    await createBoard(page, title, "3×3");
    await page.getByRole("button", { name: "ボード一覧へ" }).click();
  }
  await page.getByRole("button", { name: "バックアップを書き出す" }).click();
  // 10 or fewer: all selected at first
  for (const t of ["東京", "大阪", "京都", "奈良"]) await expect(checkbox(page, t)).toBeChecked();
  await expect(checkbox(page, "東京")).toHaveAccessibleName(/未書き出し/);
  await page.getByRole("button", { name: "すべて解除" }).click();
  await expect(page.getByRole("button", { name: "書き出す", exact: true })).toBeDisabled();
  await checkbox(page, "東京").check();
  await checkbox(page, "京都").check();
  await expect(page.locator(".export-bar")).toContainText("2 ボード・1MB 未満");
  const file = await exportSelected(page, info.outputPath("two.pbz"));
  await expect(checkbox(page, "東京")).toHaveAccessibleName(/日に書き出し/);
  await expect(checkbox(page, "大阪")).toHaveAccessibleName(/未書き出し/);

  // the file holds just the two chosen boards
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await page.getByLabel("バックアップを読み込む").setInputFiles(file);
  await expect(page.getByRole("dialog", { name: "バックアップを読み込む" })).toContainText(
    "合計 2 ボード",
  );
});

test("US4: at most 10 boards per file; two files restore all 12", async ({ page }, info) => {
  test.setTimeout(120_000);
  const titles = Array.from({ length: 12 }, (_, i) => `B${String(i + 1).padStart(2, "0")}`);
  for (const title of titles) {
    await createBoard(page, title, "3×3");
    await page.getByRole("button", { name: "ボード一覧へ" }).click();
  }
  await page.getByRole("button", { name: "バックアップを書き出す" }).click();
  await expect(page.getByText("1 回に書き出せるのは 10 ボードまでです")).toBeVisible();
  await expect(page.getByRole("button", { name: "すべて選択" })).toHaveCount(0);
  for (const t of titles) await expect(checkbox(page, t)).not.toBeChecked();

  for (const t of titles.slice(0, 10)) await checkbox(page, t).check();
  await checkbox(page, "B11").click({ force: true }); // aria-disabled: a tap still reaches it
  await expect(checkbox(page, "B11")).not.toBeChecked();
  await expect(page.locator(".export-limit")).toHaveText(
    "1 回に書き出せるのは 10 ボードまでです。残りは別に書き出してください",
  );
  const first = await exportSelected(page, info.outputPath("first.pbz"));

  // the two left are listed first as never exported
  const rows = page.locator(".export-row-title");
  await expect(rows.nth(0)).toHaveText(/B1[12]/);
  await expect(rows.nth(1)).toHaveText(/B1[12]/);
  await checkbox(page, "B11").check();
  await checkbox(page, "B12").check();
  const second = await exportSelected(page, info.outputPath("second.pbz"));

  // one more board, then replace everything with both files
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await createBoard(page, "消える", "3×3");
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await page.getByLabel("バックアップを読み込む").setInputFiles([first, second]);
  const dialog = page.getByRole("dialog", { name: "バックアップを読み込む" });
  await expect(dialog).toContainText("合計 12 ボード");
  await dialog.getByRole("radio", { name: "すべて置き換える" }).check();
  await dialog.getByRole("button", { name: "読み込む" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("端末にある 1 個のボードを削除し");
  await page.getByRole("alertdialog").getByRole("button", { name: "置き換える" }).click();
  const done = page.getByRole("dialog", { name: "読み込みが終わりました" });
  await expect(done).toContainText("上書き 12 ボード");
  await done.getByRole("button", { name: "閉じる" }).click();
  await expect(page.locator(".board-item")).toHaveCount(12);
});
