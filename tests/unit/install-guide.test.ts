import { describe, expect, it } from "vitest";
import {
  SHARE_ICON,
  detectGuide,
  guideSteps,
  shouldShowBanner,
  type GuideEnv,
  type InstallPromptRecord,
} from "../../src/pwa/installPrompt";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
  iphoneEdge:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/130.0.0.0 Mobile/15E148 Safari/605.1.15",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  macEdge:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0",
};
const inApp = {
  line: `${UA.iphoneSafari} Line/14.0.0`,
  instagram: `${UA.iphoneSafari} Instagram 300.0.0.0`,
  facebook: `${UA.iphoneSafari} [FBAN/FBIOS;FBAV/450.0.0]`,
  x: `${UA.androidChrome} Twitter for Android`,
};

const env = (userAgent: string, over: Partial<GuideEnv> = {}): GuideEnv => ({
  userAgent,
  maxTouchPoints: /iPhone|Android/.test(userAgent) ? 5 : 0,
  standalone: false,
  hasInstallEvent: false,
  ...over,
});

describe("detectGuide (research.md R1)", () => {
  it.each([
    ["iPhone Safari", env(UA.iphoneSafari), "ios"],
    ["iPhone Chrome", env(UA.iphoneChrome), "ios-other"],
    ["iPhone Edge", env(UA.iphoneEdge), "ios-other"],
    ["iPadOS (desktop UA with touch)", env(UA.macSafari, { maxTouchPoints: 5 }), "ios"],
    ["Mac Safari", env(UA.macSafari), "mac-safari"],
    ["Mac Chrome without the browser's offer", env(UA.macChrome), "none"],
    ["Mac Edge with the browser's offer", env(UA.macEdge, { hasInstallEvent: true }), "one-tap"],
    ["Android Chrome with the offer", env(UA.androidChrome, { hasInstallEvent: true }), "one-tap"],
    ["Android Chrome without the offer", env(UA.androidChrome), "none"],
    ["LINE", env(inApp.line), "in-app"],
    ["Instagram", env(inApp.instagram), "in-app"],
    ["Facebook", env(inApp.facebook), "in-app"],
    ["X, even with an offer", env(inApp.x, { hasInstallEvent: true }), "in-app"],
    ["iPhone Firefox", env(UA.iphoneFirefox), "none"],
    ["Android Firefox", env(UA.androidFirefox), "none"],
    ["an unknown browser", env("SomethingElse/1.0"), "none"],
  ] as const)("%s → %s", (_name, e, guide) => {
    expect(detectGuide(e)).toBe(guide);
  });

  it("never guides inside the installed app", () => {
    for (const ua of Object.values(UA))
      expect(detectGuide(env(ua, { standalone: true, hasInstallEvent: true }))).toBe("none");
  });
});

describe("shouldShowBanner (FR-007, FR-008)", () => {
  const now = Date.parse("2026-10-03T00:00:00.000Z");
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();
  const rec = (over: Partial<InstallPromptRecord> = {}): InstallPromptRecord => ({
    dismissCount: 0,
    lastDismissedAt: null,
    installed: false,
    ...over,
  });

  it("shows on the first visit, but not without a guide", () => {
    expect(shouldShowBanner(rec(), "ios", now)).toBe(true);
    expect(shouldShowBanner(rec(), "none", now)).toBe(false);
  });
  it("shows once more 30 days after the first close", () => {
    expect(
      shouldShowBanner(rec({ dismissCount: 1, lastDismissedAt: daysAgo(29) }), "ios", now),
    ).toBe(false);
    expect(
      shouldShowBanner(rec({ dismissCount: 1, lastDismissedAt: daysAgo(30) }), "ios", now),
    ).toBe(true);
  });
  it("never shows after the second close or once installed", () => {
    expect(
      shouldShowBanner(rec({ dismissCount: 2, lastDismissedAt: daysAgo(400) }), "ios", now),
    ).toBe(false);
    expect(shouldShowBanner(rec({ installed: true }), "one-tap", now)).toBe(false);
  });
});

describe("guideSteps (contracts/install-banner.md)", () => {
  it("shows where the share button is on iPhone Safari and other iPhone browsers", () => {
    expect(guideSteps("ios")).toEqual([
      ["画面下の「…」または共有ボタン", SHARE_ICON, "をタップ"],
      ["「ホーム画面に追加」を選ぶ"],
    ]);
    expect(guideSteps("ios-other")).toEqual([
      ["アドレスバーの共有ボタン", SHARE_ICON, "をタップ"],
      ["「ホーム画面に追加」を選ぶ"],
    ]);
  });
  it("uses the File menu on Mac Safari", () => {
    expect(guideSteps("mac-safari")).toEqual([["メニューの「ファイル」→「Dock に追加」を選ぶ"]]);
  });
  it("has no steps where there is a button or nothing to show", () => {
    for (const g of ["one-tap", "in-app", "none"] as const) expect(guideSteps(g)).toEqual([]);
  });
});
