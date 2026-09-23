import { reportError } from "../app/errors";
import { exportBackup } from "../backup/exportBackup";
import { applyBackup, detectConflicts, parseBackup, type Resolution } from "../backup/importBackup";
import { shareOrDownload } from "../media/shareImage";
import { listBoards } from "../storage/boards";
import { confirm } from "./components/ConfirmDialog";
import { showToast } from "./components/Toast";

/** Exports all boards (or the given ones) and hands the file to the share sheet / download. */
export const runExport = async (boardIds?: string[]) => {
  try {
    const { blob, fileName } = await exportBackup(boardIds);
    const result = await shareOrDownload(blob, fileName);
    if (result !== "cancelled") showToast("バックアップを書き出しました");
    return true;
  } catch (e) {
    reportError(e, "バックアップを書き出せませんでした");
    return false;
  }
};

/** Reads a backup file, asks what to do with boards that already exist, and writes it. */
export const runImport = async (file: File) => {
  try {
    const parsed = await parseBackup(await file.text());
    const existing = (await listBoards()).map((b) => b.id);
    const resolutions: Record<string, Resolution> = {};
    for (const b of detectConflicts(parsed, existing)) {
      const overwrite = await confirm({
        title: `「${b.title}」はすでにあります`,
        message: "上書きすると、端末にあるこのボードと写真はバックアップの内容に置き換わります。",
        confirmLabel: "上書き",
        cancelLabel: "別のボードとして追加",
        danger: true,
      });
      resolutions[b.id] = overwrite ? "overwrite" : "copy";
    }
    const boards = await applyBackup(parsed, resolutions);
    showToast(`${boards.length} 件のボードを読み込みました`);
    return true;
  } catch (e) {
    reportError(e, "バックアップを読み込めませんでした");
    return false;
  }
};
