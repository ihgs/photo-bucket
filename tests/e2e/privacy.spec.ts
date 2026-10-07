import { expect, test } from "@playwright/test";
import {
  closeSheet,
  createBoard,
  disableWebShare,
  fillCell,
  fixturePath,
  openExport,
  openBackupExport,
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
  await openBackupExport(page);
  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "書き出す", exact: true }).click(),
  ]);
  expect(external).toEqual([]);
});

test("loading a template from a URL sends only a plain GET to that URL (constitution I v1.3.0)", async ({
  page,
}) => {
  const url = "https://templates.example/seasons.json";
  await page.route(url, (route) =>
    route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: {
        format: "bucket-grid-template",
        version: 1,
        name: "通信の確認",
        title: "通信の確認",
        rows: [
          ["a", "b", "c"],
          ["d", "e", "f"],
          ["g", "h", "i"],
        ],
      },
    }),
  );
  // Something on the device that must not leak: an existing board.
  await createBoard(page, "ひみつのボード", "3×3");
  await fillCell(page, 1, 1, "ひみつの項目");

  const external: {
    method: string;
    url: string;
    body: string | null;
    headers: Record<string, string>;
  }[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.host !== "localhost:4173" && !["data:", "blob:"].includes(u.protocol))
      external.push({
        method: req.method(),
        url: req.url(),
        body: req.postData(),
        headers: req.headers(),
      });
  });
  await page.goto("./#/new");
  await page.getByRole("button", { name: "テンプレート", exact: true }).click();
  await page.getByRole("button", { name: "テンプレートを取り込む" }).click();
  await page.getByLabel("テンプレートの URL").fill(url);
  await page.getByRole("button", { name: "読み込む" }).click();
  await expect(page.getByText("取り込んだテンプレート: 通信の確認")).toBeVisible();

  expect(external).toHaveLength(1);
  const [req] = external;
  expect(req.method).toBe("GET");
  expect(req.url).toBe(url);
  expect(req.body).toBeNull();
  expect(Object.keys(req.headers)).not.toContain("cookie");
  expect(Object.keys(req.headers)).not.toContain("referer");
  expect(JSON.stringify(req)).not.toContain("ひみつ");
});
