import { expect, test, type Page } from "@playwright/test";
import { cell } from "./helpers";

const template = (page: Page, name: string) =>
  page.getByRole("radio", { name: new RegExp(`^${name}`) });
const size = (page: Page, label: string) =>
  page.getByRole("radiogroup", { name: "マス目のサイズ" }).getByRole("radio", {
    name: new RegExp(`^${label}`),
  });
const title = (page: Page) => page.getByLabel("タイトル");

test("US1: create a board from the domestic travel template", async ({ page }) => {
  await page.goto("./#/new");
  await expect(template(page, "使わない")).toHaveAttribute("aria-checked", "true");

  await template(page, "国内旅行").click();
  await expect(title(page)).toHaveValue("国内旅行");
  await expect(size(page, "3×4")).toHaveAttribute("aria-checked", "true");
  await size(page, "5×5").click({ force: true }); // locked while a template is chosen
  await expect(size(page, "3×4")).toHaveAttribute("aria-checked", "true");
  const preview = page.getByRole("region", { name: "入る項目" });
  await expect(preview).toContainText("北海道旅行");
  await expect(preview).toContainText("沖縄旅行");

  await page.getByRole("button", { name: "ボードを作る" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "国内旅行" })).toBeVisible();
  await expect(page.locator(".grid-cell:not(.empty)")).toHaveCount(12);
  await expect(cell(page, 1, 1)).toHaveAttribute("aria-label", /北海道旅行/);
  await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /沖縄旅行/);
  await expect(cell(page, 1, 1)).toContainText("行きたい");
});

test("US1: the year goes into the title", async ({ page }) => {
  await page.goto("./#/new");
  await template(page, "一年の目標").click();
  await expect(title(page)).toHaveValue(`${new Date().getFullYear()}年の目標`);
  await expect(size(page, "5×5")).toHaveAttribute("aria-checked", "true");
});

test("US1: going back to no template restores what was typed", async ({ page }) => {
  await page.goto("./#/new");
  await title(page).fill("旅");
  await size(page, "4×4").click();
  await template(page, "国内旅行").click();
  await template(page, "季節の楽しみ").click();
  await expect(title(page)).toHaveValue("季節の楽しみ");
  await template(page, "使わない").click();
  await expect(title(page)).toHaveValue("旅");
  await expect(size(page, "4×4")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("region", { name: "入る項目" })).toHaveCount(0);
});

test("US1: the title can be changed before creating", async ({ page }) => {
  await page.goto("./#/new");
  await template(page, "国内旅行").click();
  await title(page).fill("2027年 国内旅行");
  await page.getByRole("button", { name: "ボードを作る" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "2027年 国内旅行" })).toBeVisible();
  await expect(page.locator(".grid-cell:not(.empty)")).toHaveCount(12);
});

test("US2: a board from a template is edited and moved like any board", async ({ page }) => {
  await page.goto("./#/new");
  await template(page, "国内旅行").click();
  await page.getByRole("button", { name: "ボードを作る" }).click();
  await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /沖縄旅行/);

  await cell(page, 4, 3).click();
  await page.getByRole("button", { name: "やりたいこととカテゴリを編集" }).click();
  await page.getByLabel("やりたいこと", { exact: true }).fill("石垣島でダイビング");
  await page.getByRole("button", { name: "完了" }).click();
  await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /石垣島でダイビング/);
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "移動" }).click();
  await cell(page, 1, 1).click();
  await cell(page, 4, 3).click();
  await page.getByRole("button", { name: "完了" }).click();
  await expect(cell(page, 1, 1)).toHaveAttribute("aria-label", /石垣島でダイビング/);
  await expect(cell(page, 4, 3)).toHaveAttribute("aria-label", /北海道旅行/);
});
