import { expect, test, type Page } from "@playwright/test";
import { createBoard } from "./helpers";

const banner = (page: Page) => page.locator(".install-banner");

/** Makes the page receive a fake install offer, as Chrome does, answering with `outcome`. */
const fakeInstallOffer = async (page: Page, outcome: "accepted" | "dismissed") => {
  await page.addInitScript((outcome) => {
    (window as unknown as { promptCalls: number }).promptCalls = 0;
    window.addEventListener("load", () => {
      const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
      e.prompt = async () => {
        (window as unknown as { promptCalls: number }).promptCalls++;
      };
      e.userChoice = Promise.resolve({ outcome });
      setTimeout(() => window.dispatchEvent(e), 50);
    });
  }, outcome);
};

const promptCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { promptCalls: number }).promptCalls);

test.describe("one tap (Chrome, Edge)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test("US1: the offer shows a button that opens the install dialog", async ({ page }) => {
    await fakeInstallOffer(page, "accepted");
    await page.goto("./");
    await expect(banner(page)).toContainText("ホーム画面に追加すると、アプリのように使えます");
    await banner(page).getByRole("button", { name: "アプリとして追加" }).click();
    expect(await promptCalls(page)).toBe(1);
    await expect(banner(page)).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(300); // the fake offer arrives again
    await expect(page.getByRole("button", { name: "最初のボードを作る" })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  });

  test("US1: cancelling the install dialog counts as closing", async ({ page }) => {
    await fakeInstallOffer(page, "dismissed");
    await page.goto("./");
    await banner(page).getByRole("button", { name: "アプリとして追加" }).click();
    await expect(banner(page)).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(300);
    await expect(banner(page)).toHaveCount(0);
  });

  test("US1: nothing without an offer, or inside the installed app", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByRole("button", { name: "最初のボードを作る" })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(banner(page)).toHaveCount(0);

    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q.includes("display-mode: standalone")
          ? ({ ...real(q), matches: true, media: q } as MediaQueryList)
          : real(q);
    });
    await fakeInstallOffer(page, "accepted");
    await page.reload();
    await page.waitForTimeout(300);
    await expect(banner(page)).toHaveCount(0);
  });
});

test.describe("steps (iPhone)", () => {
  test.skip(({ browserName }) => browserName !== "webkit", "WebKit (iPhone) only");

  test("US2: steps with the share icon; the data warning only when boards exist", async ({
    page,
  }) => {
    await page.goto("./");
    await expect(banner(page)).toContainText("「ホーム画面に追加」を選ぶ");
    await expect(banner(page).getByRole("img", { name: "共有ボタン" })).toBeVisible();
    await expect(banner(page)).not.toContainText("引き継がれません");

    await createBoard(page, "旅", "3×3");
    await expect(banner(page)).toHaveCount(0); // not on the board screen
    await page.getByRole("button", { name: "ボード一覧へ" }).click();
    await expect(banner(page)).toContainText(
      "ホーム画面に追加したアプリには、ここで作ったボードは引き継がれません",
    );
    await banner(page).getByRole("button", { name: "バックアップを書き出す" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "バックアップを書き出す" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "ボード一覧へ" }).click();

    await banner(page).getByRole("button", { name: "閉じる" }).click();
    await expect(banner(page)).toHaveCount(0);
    await page.reload();
    // the app reopens the last board on launch (001); go back to the list
    await page.getByRole("button", { name: "ボード一覧へ" }).click();
    await expect(page.locator(".board-item")).toHaveCount(1);
    await expect(banner(page)).toHaveCount(0);
  });
});

test.describe("in-app browsers", () => {
  test.skip(({ browserName }) => browserName !== "webkit", "WebKit (iPhone) only");

  test("US3: LINE asks to open the app in a real browser", async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 Line/14.0.0",
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(baseURL!);
    await expect(banner(page)).toContainText("ブラウザで開くと、ホーム画面に追加できます");
    await expect(banner(page)).toContainText(
      "「ブラウザで開く」を選び、Safari（Android では Chrome）で開いてください",
    );
    await expect(banner(page)).not.toContainText("引き継がれません");
    await context.close();
  });
});
