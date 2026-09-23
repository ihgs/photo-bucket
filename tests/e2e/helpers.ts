import { expect, type Page } from "@playwright/test";

export const createBoard = async (page: Page, title: string, size: string) => {
  await page.goto("./#/new");
  await page.getByLabel("タイトル").fill(title);
  await page.getByRole("radio", { name: new RegExp(`^${size}`) }).click();
  await page.getByRole("button", { name: "ボードを作る" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
};

export const cell = (page: Page, row: number, col: number) =>
  page.locator(`.grid-cell[data-row="${row - 1}"][data-col="${col - 1}"]`);

export const fillCell = async (
  page: Page,
  row: number,
  col: number,
  title: string,
  category = "やりたい",
) => {
  await cell(page, row, col).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("やりたいこと").fill(title);
  await sheet.getByRole("radio", { name: category }).click();
  await expect(cell(page, row, col)).toHaveAttribute("aria-label", new RegExp(title));
};

export const closeSheet = async (page: Page) => {
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
};

/**
 * Opens the export screen of the board currently shown. The "画像として保存" button only appears
 * once every cell is achieved (FR-013), so tests that export a partial board go there directly.
 */
export const openExport = async (page: Page) => {
  await page.evaluate(() => {
    location.hash = `${location.hash.replace(/\/$/, "")}/export`;
  });
  await expect(page.getByRole("heading", { level: 1, name: "画像として保存" })).toBeVisible();
};

/** Makes the export use a plain download instead of the share sheet. */
export const disableWebShare = async (page: Page) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "canShare", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
  });
};

export const fixturePath = (name: string) =>
  new URL(`./fixtures/${name}`, import.meta.url).pathname;

/**
 * Seeds a board whose every cell has a photo, directly into IndexedDB (stored format, see
 * data-model.md). Returns the board id. The app must have been opened once so the DB exists.
 */
export const seedFullBoard = async (
  page: Page,
  title: string,
  cols: number,
  rows: number,
  photo: Buffer,
) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return page.evaluate(
    async ({ title, cols, rows, bytes }) => {
      const data = Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0)).buffer;
      const bitmap = await createImageBitmap(new Blob([data], { type: "image/jpeg" }));
      const db: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open("photo-bucket");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const boardId = crypto.randomUUID();
      const now = new Date().toISOString();
      const tx = db.transaction(["boards", "photos"], "readwrite");
      const cells = [];
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const photoId = crypto.randomUUID();
          tx.objectStore("photos").put({
            id: photoId,
            boardId,
            type: "image/jpeg",
            bytes: data,
            thumbBytes: data,
            width: bitmap.width,
            height: bitmap.height,
          });
          cells.push({
            id: crypto.randomUUID(),
            row,
            col,
            title: `項目${row * cols + col + 1}`,
            category: "want",
            memo: "",
            photoId,
            crop: { cx: 0.5, cy: 0.5, zoom: 1 },
            achievedAt: now,
          });
        }
      tx.objectStore("boards").put({
        id: boardId,
        title,
        size: { cols, rows },
        cells,
        createdAt: now,
        updatedAt: now,
      });
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      db.close();
      return boardId;
    },
    { title, cols, rows, bytes: photo.toString("base64") },
  );
};
