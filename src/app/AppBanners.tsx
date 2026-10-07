import { signal } from "@preact/signals";
import { updateAvailable, updateNow } from "../pwa/registerSW";

/** Whether the browser reports a network connection. */
export const online = signal(typeof navigator === "undefined" ? true : navigator.onLine);
if (typeof window !== "undefined") {
  window.addEventListener("online", () => (online.value = true));
  window.addEventListener("offline", () => (online.value = false));
}

export const AppBanners = () => (
  <>
    {!online.value && (
      <p class="offline-pill" role="status">
        オフラインです（すべての機能を使えます）
      </p>
    )}
    {updateAvailable.value && (
      <div class="update-bar" role="status">
        <span>新しいバージョンがあります</span>
        <button type="button" class="btn btn-primary" onClick={() => void updateNow()}>
          更新
        </button>
      </div>
    )}
  </>
);
