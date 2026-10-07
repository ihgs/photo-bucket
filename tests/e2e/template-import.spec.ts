import { expect, test, type Page } from "@playwright/test";
import { cell } from "./helpers";

/** The example in specs/006-template-import/contracts/template-format.md. */
const EXAMPLE = {
  format: "bucket-grid-template",
  version: 1,
  name: "季節の楽しみ",
  title: "{年}年 季節の楽しみ",
  description: "春夏秋冬、季節ごとの楽しみを写真に残そう",
  category: "やりたい",
  rows: [
    ["お花見をする", { title: "いちご狩りに行く", category: "行きたい" }, "潮干狩りをする"],
    ["海で泳ぐ", { title: "かき氷を食べる", category: "食べたい" }, null],
    ["紅葉狩りに行く", "お月見をする", { title: "栗ごはんを食べる", category: "eat" }],
  ],
};
const YEAR = new Date().getFullYear();

const sheet = (page: Page) => page.getByRole("dialog");
const size = (page: Page, label: string) =>
  page.getByRole("radiogroup", { name: "マス目のサイズ" }).getByRole("radio", {
    name: new RegExp(`^${label}`),
  });

/** #/new → テンプレート → テンプレートを取り込む */
const openImport = async (page: Page) => {
  await page.goto("./#/new");
  await page.getByRole("button", { name: "テンプレート", exact: true }).click();
  await sheet(page).getByRole("button", { name: "テンプレートを取り込む" }).click();
  await expect(page.getByRole("dialog", { name: "テンプレートを取り込む" })).toBeVisible();
};
const paste = async (page: Page, value: object | string) => {
  await page
    .getByLabel("テンプレートの中身")
    .fill(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  await page.getByRole("button", { name: "取り込む", exact: true }).click();
};

test("US1: paste a template and create a board from it", async ({ page }) => {
  await openImport(page);
  await expect(page.getByLabel("テンプレートの中身")).toBeVisible();
  await paste(page, EXAMPLE);

  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByText("取り込んだテンプレート: 季節の楽しみ")).toBeVisible();
  await expect(page.getByLabel("タイトル")).toHaveValue(`${YEAR}年 季節の楽しみ`);
  await expect(size(page, "3×3")).toHaveAttribute("aria-checked", "true");
  await size(page, "5×5").click({ force: true }); // locked while a template is chosen
  await expect(size(page, "3×3")).toHaveAttribute("aria-checked", "true");
  const preview = page.getByRole("region", { name: "入る項目" }).getByRole("listitem");
  await expect(preview).toHaveCount(9);
  await expect(preview.nth(5)).toHaveText("（空き）");

  await page.getByRole("button", { name: "ボードを作る" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: `${YEAR}年 季節の楽しみ` }),
  ).toBeVisible();
  await expect(page.locator(".grid-cell:not(.empty)")).toHaveCount(8);
  await expect(cell(page, 1, 2)).toHaveAttribute("aria-label", /いちご狩りに行く/);
  await expect(cell(page, 1, 2)).toContainText("行きたい");
  await expect(cell(page, 2, 2)).toContainText("食べたい");
  await expect(cell(page, 2, 3)).toHaveClass(/empty/);
});

test("US1: a broken template shows what is wrong and changes nothing", async ({ page }) => {
  await openImport(page);
  const rows = EXAMPLE.rows.map((r) => [...r]);
  rows[0][0] = "あ".repeat(61);
  await paste(page, { ...EXAMPLE, rows });
  await expect(page.getByRole("alert")).toContainText(
    "1 行目 1 列目: タイトルは60文字以内にしてください",
  );
  await expect(page.getByRole("dialog", { name: "テンプレートを取り込む" })).toBeVisible();

  await paste(page, "{ not json");
  await expect(page.getByRole("alert")).toContainText("JSON として読めません");
});

test("US1: imported text is shown as text, never run as HTML", async ({ page }) => {
  await openImport(page);
  const html = '<img src=x onerror="window.__xss=1">';
  const rows = EXAMPLE.rows.map((r) => [...r]);
  rows[0][0] = html;
  await paste(page, { ...EXAMPLE, rows });
  await expect(
    page.getByRole("region", { name: "入る項目" }).getByRole("listitem").first(),
  ).toHaveText(html);
  expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
});

test("US1: imported templates are not kept, and can be undone", async ({ page }) => {
  await page.goto("./#/new");
  await page.getByLabel("タイトル").fill("旅");
  await size(page, "4×4").click();
  await page.getByRole("button", { name: "テンプレート", exact: true }).click();
  const importButton = sheet(page).getByRole("button", { name: "テンプレートを取り込む" });
  await importButton.click();
  await sheet(page).getByRole("button", { name: "戻る" }).click();
  await expect(importButton).toBeFocused();
  await importButton.click();
  await paste(page, EXAMPLE);

  // Not listed in the sheet afterwards (FR-010).
  await page.getByRole("button", { name: "テンプレート", exact: true }).click();
  await expect(sheet(page).locator(".template-option")).toHaveCount(4);
  await sheet(page).getByRole("button", { name: "閉じる" }).click();

  await page.getByRole("button", { name: "やめる" }).click();
  await expect(page.getByLabel("タイトル")).toHaveValue("旅");
  await expect(size(page, "4×4")).toHaveAttribute("aria-checked", "true");
});

const TEMPLATE_URL = "https://templates.example/seasons.json";
const CORS = { "Access-Control-Allow-Origin": "*" };
const load = async (page: Page, url: string) => {
  await page.getByLabel("テンプレートの URL").fill(url);
  await page.getByRole("button", { name: "読み込む" }).click();
};

test("US2: load a template from a URL", async ({ page }) => {
  await page.route(TEMPLATE_URL, (route) => route.fulfill({ json: EXAMPLE, headers: CORS }));
  await openImport(page);
  await load(page, TEMPLATE_URL);
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByText("取り込んだテンプレート: 季節の楽しみ")).toBeVisible();
  await expect(page.getByLabel("タイトル")).toHaveValue(`${YEAR}年 季節の楽しみ`);
  await page.getByRole("button", { name: "ボードを作る" }).click();
  await expect(page.locator(".grid-cell:not(.empty)")).toHaveCount(8);
});

test("US2: explains why a URL could not be read", async ({ page }) => {
  await page.route("https://templates.example/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    // Playwright's fulfill skips the CORS check, so a refused or unreachable host is an abort:
    // in the browser both end as the same network error.
    if (path === "/blocked.json") return route.abort("accessdenied");
    if (path === "/page.html")
      return route.fulfill({
        body: "<!doctype html><title>x</title>",
        contentType: "text/html",
        headers: CORS,
      });
    return route.fulfill({ status: 404, body: "", headers: CORS });
  });
  await openImport(page);
  const alert = page.getByRole("alert");
  const hint = "中身をコピーして、下の「中身を貼り付け」で取り込むこともできます。";

  await load(page, "https://templates.example/blocked.json");
  await expect(alert).toContainText(
    "この URL からは読み込めませんでした（公開先が読み込みを許可していないか、つながりません）",
  );
  await expect(alert).toContainText(hint);

  await load(page, "https://templates.example/missing.json");
  await expect(alert).toContainText("ファイルが見つかりませんでした");

  await load(page, "https://templates.example/page.html");
  await expect(alert).toContainText("Web ページのようです");

  let requested = false;
  page.on("request", (r) => {
    if (r.url().startsWith("http://templates.example")) requested = true;
  });
  await load(page, "http://templates.example/a.json");
  await expect(alert).toContainText("https で始まる URL を入れてください");
  expect(requested).toBe(false);
});

test("US2: loading can be cancelled", async ({ page }) => {
  await page.route(TEMPLATE_URL, async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.fulfill({ json: EXAMPLE, headers: CORS }).catch(() => undefined);
  });
  await openImport(page);
  await load(page, TEMPLATE_URL);
  await expect(page.getByText("読み込み中…")).toBeVisible();
  await page.getByRole("button", { name: "やめる" }).click();
  await expect(page.getByText("読み込み中…")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "読み込む" })).toBeEnabled();
});

test("US2: offline, URLs cannot be read but pasting still works (SC-005)", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "setOffline is reliable on Chromium only");
  await openImport(page);
  await context.setOffline(true);
  await expect(page.getByText("オフラインのため URL からは読み込めません")).toBeVisible();
  await load(page, TEMPLATE_URL);
  await expect(page.getByRole("alert")).toContainText("通信できないため読み込めませんでした");
  await paste(page, EXAMPLE);
  await expect(page.getByText("取り込んだテンプレート: 季節の楽しみ")).toBeVisible();
});
