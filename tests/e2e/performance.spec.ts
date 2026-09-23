import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fixturePath, seedFullBoard } from "./helpers";

test("SC-006: a board with 25 photos is shown within 2 seconds even with 3 such boards", async ({
  page,
}) => {
  // A realistic 1600×1200 photo, as stored after import.
  const photo = readFileSync(fixturePath("large-photo.jpg"));
  const ids = [];
  for (let i = 1; i <= 3; i++) ids.push(await seedFullBoard(page, `ボード${i}`, 5, 5, photo));

  await page.goto("./#/");
  await page
    .getByRole("button", { name: "ボード一覧へ" })
    .or(page.getByRole("heading", { name: "フォトバケットリスト" }))
    .first()
    .waitFor();
  const start = Date.now();
  await page.goto(`./#/boards/${ids[1]}`);
  await expect(page.locator(".grid-cell img")).toHaveCount(25);
  await expect
    .poll(() =>
      page
        .locator(".grid-cell img")
        .evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete)),
    )
    .toBe(true);
  expect(Date.now() - start).toBeLessThan(2000);
});
