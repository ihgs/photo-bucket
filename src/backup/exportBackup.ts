import type { Board } from "../domain/types";
import { getBoard, listBoards } from "../storage/boards";
import { getPhotosOfBoard } from "../storage/photos";
import { updatePreferences } from "../storage/preferences";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_MANIFEST,
  photoPath,
  type BackupJson,
} from "./format";
import { createZip, type ZipEntryInput } from "./zip";

const pad2 = (n: number) => String(n).padStart(2, "0");

export const backupFileName = (d = new Date()) =>
  `photo-bucket-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.pbz`;

/** Builds a .pbz (ZIP) backup of all boards, or of the given boards (contracts/backup-format.md). */
export const exportBackup = async (boardIds?: string[]) => {
  const boards: Board[] = boardIds
    ? (await Promise.all(boardIds.map(getBoard))).filter((b): b is Board => !!b)
    : await listBoards();
  const photos: BackupJson["photos"] = [];
  const photoEntries: ZipEntryInput[] = [];
  for (const board of boards) {
    for (const p of await getPhotosOfBoard(board.id)) {
      const type = p.blob.type || "image/jpeg";
      const path = photoPath(p.id, type);
      photos.push({ id: p.id, boardId: p.boardId, width: p.width, height: p.height, type, path });
      photoEntries.push({ name: path, data: p.blob });
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
  const blob = await createZip(
    [
      { name: BACKUP_MANIFEST, data: new TextEncoder().encode(JSON.stringify(json)) },
      ...photoEntries,
    ],
    now,
  );
  await updatePreferences({ lastBackupAt: now.toISOString() });
  return { blob, fileName: backupFileName(now) };
};
