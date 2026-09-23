import { expect, test } from "@playwright/test";
import { cell, closeSheet, createBoard, fillCell } from "./helpers";

const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

test("US2: attach a photo, EXIF is removed, detach returns to not achieved", async ({ page }) => {
  await createBoard(page, "旅", "3×3");
  await fillCell(page, 2, 2, "富士山に登る", "行きたい");

  await page.getByLabel("ライブラリから選ぶ").setInputFiles(fixture("gps-photo.jpg"));
  await expect(page.getByText(/\d{4}年\d{1,2}月\d{1,2}日 達成/)).toBeVisible();
  await closeSheet(page);

  await expect(cell(page, 2, 2)).toHaveAttribute("aria-label", "2行2列 富士山に登る 達成済み");
  await expect(cell(page, 2, 2).locator("img")).toBeVisible();
  await expect(page.getByText("1/9 達成")).toBeVisible();

  // The stored photo must not contain the EXIF block (and therefore no GPS data).
  const result = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("photo-bucket");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const photos: {
      type: string;
      bytes: ArrayBuffer;
      thumbBytes: ArrayBuffer;
      width: number;
      height: number;
    }[] = await new Promise((res) => {
      const req = db.transaction("photos").objectStore("photos").getAll();
      req.onsuccess = () => res(req.result);
    });
    const hasExif = async (b: ArrayBuffer) => {
      const bytes = new Uint8Array(b);
      const text = Array.from(bytes.subarray(0, 4096), (x) => String.fromCharCode(x)).join("");
      return text.includes("Exif\0\0");
    };
    return {
      count: photos.length,
      type: photos[0].type,
      width: photos[0].width,
      height: photos[0].height,
      exif: (await hasExif(photos[0].bytes)) || (await hasExif(photos[0].thumbBytes)),
    };
  });
  expect(result).toEqual({ count: 1, type: "image/jpeg", width: 600, height: 900, exif: false });

  // Detach
  await cell(page, 2, 2).click();
  await page.getByRole("button", { name: "写真を外す" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "外す" }).click();
  await closeSheet(page);
  await expect(cell(page, 2, 2)).toHaveAttribute("aria-label", "2行2列 富士山に登る 未達成");
  await expect(page.getByText("0/9 達成")).toBeVisible();
});

test("US2: adjust the visible area and replace the photo", async ({ page }) => {
  await createBoard(page, "旅", "3×3");
  await fillCell(page, 1, 1, "海");
  await page.getByLabel("ライブラリから選ぶ").setInputFiles(fixture("landscape.jpg"));
  await expect(page.getByRole("button", { name: "表示範囲を調整" })).toBeVisible();

  await page.getByRole("button", { name: "表示範囲を調整" }).click();
  const zoom = page.getByRole("slider", { name: /拡大率/ });
  await zoom.fill("2");
  await page.getByRole("button", { name: "完了" }).click();
  await expect(page.getByRole("button", { name: "表示範囲を調整" })).toBeVisible();

  const crop = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res) => {
      const r = indexedDB.open("photo-bucket");
      r.onsuccess = () => res(r.result);
    });
    const boards: { cells: { crop?: { zoom: number } }[] }[] = await new Promise((res) => {
      const req = db.transaction("boards").objectStore("boards").getAll();
      req.onsuccess = () => res(req.result);
    });
    return boards[0].cells[0].crop;
  });
  expect(crop?.zoom).toBeCloseTo(2, 5);

  await page.getByLabel("写真を差し替える").setInputFiles(fixture("gps-photo.jpg"));
  await closeSheet(page);
  await expect(cell(page, 1, 1)).toHaveAttribute("aria-label", /達成済み/);
});

test("US2: a non-image file shows an error and leaves the cell unchanged", async ({ page }) => {
  await createBoard(page, "旅", "3×3");
  await fillCell(page, 1, 1, "海");
  await page.getByLabel("ライブラリから選ぶ").setInputFiles(fixture("not-an-image.txt"));
  await expect(page.getByText("この写真は読み込めませんでした")).toBeVisible();
  await closeSheet(page);
  await expect(cell(page, 1, 1)).toHaveAttribute("aria-label", "1行1列 海 未達成");
});
