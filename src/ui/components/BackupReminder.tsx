import { useEffect, useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { getExportLog, needsReminder } from "../../backup/exportLog";
import { listBoards } from "../../storage/boards";

/**
 * Suggests a backup while a board with photos was never exported, changed since, or was exported
 * 30+ days ago (FR-019). The button opens the export screen with those boards selected.
 */
export const BackupReminder = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    void (async () => {
      const [boards, log] = await Promise.all([listBoards(), getExportLog()]);
      const withPhotos = new Set(
        boards.filter((b) => b.cells.some((c) => c.photoId)).map((b) => b.id),
      );
      setShow(needsReminder(boards, withPhotos, log));
    })().catch(() => undefined);
  }, []);

  if (!show) return null;
  return (
    <div class="banner" role="note">
      <p>バックアップをおすすめします。写真はこの端末の中にしか保存されていません。</p>
      <button type="button" class="btn" onClick={() => navigate({ name: "backup", pending: true })}>
        書き出す
      </button>
    </div>
  );
};
