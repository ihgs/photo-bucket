import { signal } from "@preact/signals";
import { getDb, withQuotaGuard } from "../storage/db";

/** Which home-screen guidance this browser gets (data-model.md InstallGuide). */
export type InstallGuide = "one-tap" | "ios" | "ios-other" | "mac-safari" | "in-app" | "none";

/** Per-browser record of the guidance (meta store, key "installPrompt"). Not part of backups. */
export interface InstallPromptRecord {
  dismissCount: 0 | 1 | 2;
  lastDismissedAt: string | null;
  installed: boolean;
}

export interface GuideEnv {
  userAgent: string;
  maxTouchPoints: number;
  /** Running as an installed app (display-mode: standalone, or iOS navigator.standalone). */
  standalone: boolean;
  /** The browser has offered to install (beforeinstallprompt). */
  hasInstallEvent: boolean;
}

export const REPROMPT_DAYS = 30;
/** Guides on browsers whose home-screen app does not share the browser's data (FR-012). */
export const NO_SHARED_DATA: readonly InstallGuide[] = ["ios", "ios-other", "mac-safari"];

const INITIAL: InstallPromptRecord = { dismissCount: 0, lastDismissedAt: null, installed: false };
const KEY = "installPrompt";
const DAY = 24 * 60 * 60 * 1000;

// ---- which guidance (research.md R1) ----

const IN_APP = /\bLine\/|Instagram|FBAN|FBAV|Twitter/;
const IOS_OTHER = /CriOS|EdgiOS|OPiOS|GSA\//;

export const detectGuide = (env: GuideEnv): InstallGuide => {
  const ua = env.userAgent;
  if (env.standalone) return "none";
  if (/Firefox\/|FxiOS/.test(ua)) return "none";
  if (IN_APP.test(ua)) return "in-app";
  if (env.hasInstallEvent) return "one-tap";
  // iPadOS reports a Mac user agent; touch tells them apart.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && env.maxTouchPoints > 1);
  if (ios) return IOS_OTHER.test(ua) || !/Version\/.*Safari\//.test(ua) ? "ios-other" : "ios";
  if (/Macintosh/.test(ua) && /Version\/.*Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua))
    return "mac-safari";
  return "none";
};

export const shouldShowBanner = (
  record: InstallPromptRecord,
  guide: InstallGuide,
  now = Date.now(),
) => {
  if (guide === "none" || record.installed) return false;
  if (record.dismissCount === 0) return true;
  if (record.dismissCount === 1 && record.lastDismissedAt)
    return now - Date.parse(record.lastDismissedAt) >= REPROMPT_DAYS * DAY;
  return false;
};

// ---- steps for browsers without a one-tap install (research.md R3) ----

/** Marks where the share-button icon goes inside a step. */
export const SHARE_ICON = Symbol("share-icon");
export type StepPart = string | typeof SHARE_ICON;

const ADD = ["「ホーム画面に追加」を選ぶ"];

/** Steps for this guide, kept in one place so they are easy to update when the OS changes. */
export const guideSteps = (guide: InstallGuide): StepPart[][] => {
  switch (guide) {
    case "ios":
      // iOS 26 Safari moved the share button into the "…" menu; older versions show it directly.
      return [["画面下の「…」または共有ボタン", SHARE_ICON, "をタップ"], ADD];
    case "ios-other":
      return [["アドレスバーの共有ボタン", SHARE_ICON, "をタップ"], ADD];
    case "mac-safari":
      return [["メニューの「ファイル」→「Dock に追加」を選ぶ"]];
    default:
      return [];
  }
};

// ---- the browser's install offer (research.md R2) ----

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** The pending install offer, if the browser made one. prompt() can be used only once. */
export const installEvent = signal<BeforeInstallPromptEvent | null>(null);

/** Must run before the first render: browsers make the offer early, and only once. */
export const listenForInstallPrompt = () => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent.value = e as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installEvent.value = null;
    void recordInstalled().catch(() => undefined);
  });
};

/** Opens the browser's install dialog. A cancel counts as closing the guidance (FR-007). */
export const promptInstall = async () => {
  const e = installEvent.value;
  if (!e) return "unavailable" as const;
  installEvent.value = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") await recordInstalled();
  else await recordDismiss();
  return outcome;
};

export const currentGuideEnv = (): GuideEnv => ({
  userAgent: navigator.userAgent,
  maxTouchPoints: navigator.maxTouchPoints ?? 0,
  standalone:
    matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
  hasInstallEvent: installEvent.value !== null,
});

// ---- record (meta store) ----

export const getInstallRecord = async (): Promise<InstallPromptRecord> => ({
  ...INITIAL,
  ...((await (await getDb()).get("meta", KEY)) as Partial<InstallPromptRecord> | undefined),
});

const update = (fn: (r: InstallPromptRecord) => InstallPromptRecord) =>
  withQuotaGuard(async () => {
    const tx = (await getDb()).transaction("meta", "readwrite");
    const current = { ...INITIAL, ...((await tx.store.get(KEY)) as Partial<InstallPromptRecord>) };
    await tx.store.put(fn(current), KEY);
    await tx.done;
  });

export const recordDismiss = (now = Date.now()) =>
  update((r) => ({
    ...r,
    dismissCount: Math.min(2, r.dismissCount + 1) as 1 | 2,
    lastDismissedAt: new Date(now).toISOString(),
  }));

export const recordInstalled = () => update((r) => ({ ...r, installed: true }));
