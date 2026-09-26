import type { Board } from "../domain/types";
import { getBoard } from "../storage/boards";
import { getDb } from "../storage/db";
import { getPhotosOfBoard } from "../storage/photos";
import { BackupError } from "./importBackup";
import {
  BACKUP_FORMAT,
  BACKUP_MAX_BOARDS,
  BACKUP_FORMAT_VERSION,
  BACKUP_MANIFEST,
  photoPath,
  type BackupJson,
} from "./format";
import { createZip, type ZipEntryInput } from "./zip";

const pad2 = (n: number) => String(n).padStart(2, "0");

export const backupFileName = (d = new Date()) =>
  `photo-bucket-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.pbz`;

/**
 * Builds a .pbz (ZIP) backup of 1 to 10 boards (contracts/backup-format.md, FR-015). Photos are
 * read one board at a time. A missing photo stops the export instead of writing a partial file.
 */
export const exportBackup = async (boardIds: readonly string[]) => {
  if (boardIds.length === 0 || boardIds.length > BACKUP_MAX_BOARDS)
    throw new RangeError(`export 1..${BACKUP_MAX_BOARDS} boards, got ${boardIds.length}`);
  const boards: Board[] = [];
  const photos: BackupJson["photos"] = [];
  const photoEntries: ZipEntryInput[] = [];
  for (const id of boardIds) {
    const board = await getBoard(id);
    if (!board) continue;
    const stored = new Map((await getPhotosOfBoard(board.id)).map((p) => [p.id, p]));
    for (const c of board.cells) {
      if (!c.photoId) continue;
      const p = stored.get(c.photoId);
      if (!p)
        throw new BackupError(
          `『${board.title}』の写真を読み込めなかったため、書き出しを中止しました`,
        );
      const type = p.blob.type || "image/jpeg";
      const path = photoPath(p.id, type);
      photos.push({ id: p.id, boardId: p.boardId, width: p.width, height: p.height, type, path });
      photoEntries.push({ name: path, data: p.blob });
    }
    boards.push(board);
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
  return { blob, fileName: backupFileName(now) };
};

// ZIP local header (30) + central directory entry (46) + the entry name twice, plus the photo's
// line in backup.json. Names are "photos/<uuid>.jpg" (47 bytes).
const PER_PHOTO_OVERHEAD = 30 + 46 + 2 * 47 + 160;
const FIXED_OVERHEAD = 30 + 46 + 2 * 11 + 22 + 200; // backup.json entry, end record, JSON frame

/**
 * Approximate size of the backup of each board and of all of them together, without reading any
 * photo: only the `byBoardSize` index keys (research.md R7).
 */
export const estimateBackupSize = async (boardIds: readonly string[]) => {
  const db = await getDb();
  const encoder = new TextEncoder();
  const perBoard: Record<string, number> = {};
  let total = FIXED_OVERHEAD;
  for (const id of boardIds) {
    const board = await getBoard(id);
    if (!board) continue;
    let size = encoder.encode(JSON.stringify(board)).length;
    const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
    const tx = db.transaction("photos");
    for (
      let c = await tx.store.index("byBoardSize").openKeyCursor(range);
      c;
      c = await c.continue()
    )
      size += c.key[1] + PER_PHOTO_OVERHEAD;
    perBoard[id] = size;
    total += size;
  }
  return { perBoard, total };
};
