import { useEffect, useState } from "preact/hooks";
import { getDb } from "../../storage/db";
import { getPreferences } from "../../storage/preferences";
import { runExport } from "../backupActions";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/** Suggests a backup when photos exist and the last one is missing or older than 30 days. */
export const shouldRemind = (photoCount: number, lastBackupAt: string | null, now = Date.now()) =>
  photoCount > 0 && (!lastBackupAt || now - Date.parse(lastBackupAt) >= THIRTY_DAYS);

export const BackupReminder = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    void (async () => {
      const [count, prefs] = await Promise.all([(await getDb()).count("photos"), getPreferences()]);
      setShow(shouldRemind(count, prefs.lastBackupAt));
    })().catch(() => undefined);
  }, []);

  if (!show) return null;
  return (
    <div class="banner" role="note">
      <p>バックアップをおすすめします。写真はこの端末の中にしか保存されていません。</p>
      <button
        type="button"
        class="btn"
        onClick={async () => {
          if (await runExport()) setShow(false);
        }}
      >
        書き出す
      </button>
    </div>
  );
};
