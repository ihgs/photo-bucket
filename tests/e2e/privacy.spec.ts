import { expect, test } from "@playwright/test";
import {
  closeSheet,
  createBoard,
  disableWebShare,
  fillCell,
  fixturePath,
  openExport,
} from "./helpers";

test("no request leaves the app's own origin during the main flows (constitution I)", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (!["localhost:4173"].includes(url.host) && !["data:", "blob:"].includes(url.protocol))
      external.push(req.url());
  });
  await disableWebShare(page);
  await createBoard(page, "通信なし", "3×3");
  await fillCell(page, 2, 2, "写真を貼る");
  await page.getByLabel("ライブラリから選ぶ").setInputFiles(fixturePath("gps-photo.jpg"));
  await expect(page.getByRole("button", { name: "表示範囲を調整" })).toBeVisible();
  await closeSheet(page);
  await openExport(page);
  await expect(page.locator("img.export-preview")).toBeVisible();
  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "画像を保存・共有" }).click(),
  ]);
  await page.getByRole("button", { name: "ボードへ戻る" }).click();
  await page.getByRole("button", { name: "ボード一覧へ" }).click();
  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "バックアップを書き出す" }).first().click(),
  ]);
  expect(external).toEqual([]);
});
