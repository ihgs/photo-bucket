import { reportError } from "../app/errors";
import { exportBackup } from "../backup/exportBackup";
import { recordExport } from "../backup/exportLog";
import { shareOrDownload } from "../media/shareImage";
import { showToast } from "./components/Toast";

/**
 * Exports the given boards (1 to 10) and hands the file to the share sheet / download. Records the
 * export unless the share sheet was cancelled (FR-019). Returns whether the file was handed over.
 */
export const runExport = async (boardIds: string[]) => {
  try {
    const { blob, fileName } = await exportBackup(boardIds);
    const result = await shareOrDownload(blob, fileName);
    if (result === "cancelled") return false;
    await recordExport(boardIds);
    showToast(`${boardIds.length} ボードを書き出しました`);
    return true;
  } catch (e) {
    reportError(e, "バックアップを書き出せませんでした");
    return false;
  }
};
