import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { layoutBoard } from "../../src/domain/layout";
import { estimateMeasure } from "../../src/domain/measure";
import {
  closeSheet,
  createBoard,
  disableWebShare,
  fillCell,
  fixturePath,
  seedFullBoard,
} from "./helpers";
import { hasExif, jpegSize } from "./jpeg";

test.beforeEach(async ({ page }) => {
  await disableWebShare(page);
});

const exportImage = async (page: Page, includeTitle: boolean) => {
  await page.getByRole("button", { name: "画像として保存" }).click();
  const toggle = page.getByRole("checkbox", { name: "タイトルを入れる" });
  if ((await toggle.isChecked()) !== includeTitle) await toggle.click();
  await expect(page.locator("img.export-preview")).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "画像を保存・共有" }).click(),
  ]);
  const buf = readFileSync((await download.path())!);
  await page.getByRole("button", { name: "ボードへ戻る" }).click();
  return { buf, name: download.suggestedFilename() };
};

const EXPECTED: [string, number, number][] = [
  ["3×3", 2400, 2400],
  ["4×4", 2400, 2400],
  ["5×5", 2400, 2400],
  ["3×4", 1800, 2400],
  ["4×3", 2400, 1800],
];

for (const [size, w, h] of EXPECTED) {
  test(`US3: ${size} exports ${w}×${h} with and without the title`, async ({ page }) => {
    await createBoard(page, `サイズ${size}`, size);
    await fillCell(page, 1, 1, "富士山に登る", "行きたい");
    await closeSheet(page);
    const withTitle = await exportImage(page, true);
    expect(jpegSize(withTitle.buf)).toEqual({ width: w, height: h });
    expect(withTitle.name).toMatch(new RegExp(`^サイズ${size}-\\d{8}\\.jpg$`));
    const without = await exportImage(page, false);
    expect(jpegSize(without.buf)).toEqual({ width: w, height: h });
  });
}

test("US3: the exported image matches the screen (SC-004) and has no EXIF", async ({ page }) => {
  await createBoard(page, "一致テスト", "3×4");
  await fillCell(page, 1, 1, "赤と青", "行きたい");
  await page.getByLabel("ライブラリから選ぶ").setInputFiles(fixturePath("gps-photo.jpg"));
  await expect(page.getByRole("button", { name: "表示範囲を調整" })).toBeVisible();
  await closeSheet(page);
  await fillCell(page, 2, 3, "緑と黄", "食べたい");
  await page.getByLabel("ライブラリから選ぶ").setInputFiles(fixturePath("landscape.jpg"));
  await expect(page.getByRole("button", { name: "表示範囲を調整" })).toBeVisible();
  await closeSheet(page);
  await fillCell(page, 4, 2, "京都で抹茶パフェを食べる", "食べたい");
  await closeSheet(page);
  await expect(page.locator(".grid-cell img")).toHaveCount(2);

  // (1) cell positions on screen, scaled to 360px, match layoutBoard within 1px
  const grid = page.locator(".grid");
  const gridBox = (await grid.boundingBox())!;
  const k = 360 / gridBox.width;
  const expected = layoutBoard(
    { id: "x", title: "", size: { cols: 3, rows: 4 }, cells: [], createdAt: "", updatedAt: "" },
    { width: 360, includeTitle: false, measure: estimateMeasure },
  );
  const cells = page.locator(".grid-cell");
  await expect(cells).toHaveCount(12);
  for (let i = 0; i < 12; i++) {
    const b = (await cells.nth(i).boundingBox())!;
    const e = expected.cells[i];
    expect(Math.abs((b.x - gridBox.x) * k - e.x)).toBeLessThanOrEqual(1);
    expect(Math.abs((b.y - gridBox.y) * k - e.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.width * k - e.size)).toBeLessThanOrEqual(1);
  }

  const screen = await grid.screenshot();
  const { buf } = await exportImage(page, false);
  expect(hasExif(buf)).toBe(false);

  // (3) photo cells: centre 50% average colour differs by at most 8/255
  const photoCells = [expected.cells[0], expected.cells[5]];
  const diffs = await page.evaluate(
    async ({ screenB64, exportB64, regions }) => {
      const load = async (src: string) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const h = Math.round((img.naturalHeight * 360) / img.naturalWidth);
        const c = document.createElement("canvas");
        c.width = 360;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 360, h);
        return ctx;
      };
      const a = await load(`data:image/png;base64,${screenB64}`);
      const b = await load(`data:image/jpeg;base64,${exportB64}`);
      const mean = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
        const d = ctx.getImageData(Math.round(x), Math.round(y), Math.round(s), Math.round(s)).data;
        const m = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) m[j] += d[i + j];
        return m.map((v) => v / (d.length / 4));
      };
      return regions.map(({ x, y, size }) => {
        const [cx, cy, s] = [x + size / 4, y + size / 4, size / 2];
        const ma = mean(a, cx, cy, s);
        const mb = mean(b, cx, cy, s);
        return Math.max(...ma.map((v, i) => Math.abs(v - mb[i])));
      });
    },
    {
      screenB64: screen.toString("base64"),
      exportB64: buf.toString("base64"),
      regions: photoCells.map((c) => ({ x: c.x, y: c.y, size: c.size })),
    },
  );
  for (const d of diffs) expect(d).toBeLessThanOrEqual(8);
});

test("US3: a 5×5 board with 25 photos is exported within 5 seconds (SC-003)", async ({ page }) => {
  // A realistic 1600×1200 photo, as stored after import.
  const { execFileSync } = await import("node:child_process");
  const photo = execFileSync(
    "convert",
    ["-size", "1600x1200", "plasma:", "-quality", "85", "jpg:-"],
    {
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  const boardId = await seedFullBoard(page, "25枚", 5, 5, photo);
  await page.goto(`./#/boards/${boardId}`);
  await expect(page.getByText("25/25 達成")).toBeVisible();

  const start = Date.now();
  await page.getByRole("button", { name: "画像として保存" }).click();
  await expect(page.locator("img.export-preview")).toBeVisible({ timeout: 10_000 });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "画像を保存・共有" }).click(),
  ]);
  const elapsed = Date.now() - start;
  expect(jpegSize(readFileSync((await download.path())!))).toEqual({ width: 2400, height: 2400 });
  expect(elapsed).toBeLessThan(5000);
});
