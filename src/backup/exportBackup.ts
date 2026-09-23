import type { Board } from "../domain/types";
import { getBoard, listBoards } from "../storage/boards";
import { getPhotosOfBoard } from "../storage/photos";
import { updatePreferences } from "../storage/preferences";
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, bytesToBase64, type BackupJson } from "./format";

const pad2 = (n: number) => String(n).padStart(2, "0");

export const backupFileName = (d = new Date()) =>
  `photo-bucket-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.photobucket.json`;

/** Builds a backup of all boards, or of the given boards (contracts/backup-format.md). */
export const exportBackup = async (boardIds?: string[]) => {
  const boards: Board[] = boardIds
    ? (await Promise.all(boardIds.map(getBoard))).filter((b): b is Board => !!b)
    : await listBoards();
  const photos = [];
  for (const board of boards) {
    for (const p of await getPhotosOfBoard(board.id)) {
      photos.push({
        id: p.id,
        boardId: p.boardId,
        width: p.width,
        height: p.height,
        dataUrl: `data:${p.blob.type || "image/jpeg"};base64,${bytesToBase64(await p.blob.arrayBuffer())}`,
      });
    }
  }
  const now = new Date();
  const json: BackupJson = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    boards,
    photos,
  };
  const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
  await updatePreferences({ lastBackupAt: now.toISOString() });
  return { blob, fileName: backupFileName(now) };
};
