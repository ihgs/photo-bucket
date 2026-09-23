import { signal } from "@preact/signals";
import { updateAvailable, updateNow } from "../pwa/registerSW";
import type { Route } from "./router";
import { BackupReminder } from "../ui/components/BackupReminder";

const online = signal(typeof navigator === "undefined" ? true : navigator.onLine);
if (typeof window !== "undefined") {
  window.addEventListener("online", () => (online.value = true));
  window.addEventListener("offline", () => (online.value = false));
}

export const AppBanners = ({ route }: { route: Route }) => (
  <>
    {!online.value && (
      <p class="offline-pill" role="status">
        オフラインです（すべての機能を使えます）
      </p>
    )}
    {route.name === "list" && <BackupReminder />}
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
