import { expect, test } from "@playwright/test";

test("the top page introduces the app and links to it", async ({ page }) => {
  await page.goto("../");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("写真で埋めていこう");
  // Only the app is installable.
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);

  await page.getByRole("link", { name: "はじめる（無料）" }).click();
  await expect(page).toHaveURL(/\/photo-bucket\/app\/$/);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

test("an app installed before the move opens the app, not the top page", async ({ page }) => {
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query === "(display-mode: standalone)"
        ? ({ ...matchMedia(query), matches: true } as MediaQueryList)
        : matchMedia(query);
  });
  await page.goto("../#/new");
  await expect(page).toHaveURL(/\/photo-bucket\/app\/#\/new$/);
});
