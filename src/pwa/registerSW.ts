import { signal } from "@preact/signals";

/** True when a new version has been downloaded and is waiting to be activated. */
export const updateAvailable = signal(false);
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

export const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  const { registerSW } = await import("virtual:pwa-register");
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable.value = true;
    },
  });
};

/** Activates the waiting version and reloads. User data lives in IndexedDB and is kept (FR-022). */
export const updateNow = () => applyUpdate?.(true);
