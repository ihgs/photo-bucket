import { UserFacingError } from "../app/errors";
import type { Board, Cell, Photo } from "../domain/types";
import { BOARD_TITLE_MAX, validateBoard } from "../domain/validation";
import { importPhoto } from "../media/importPhoto";
import { getDb, withQuotaGuard } from "../storage/db";
import { deletePhotosOfBoardInTx, releasePhotoUrls, toStored } from "../storage/photos";
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, base64ToBytes } from "./format";

export class BackupError extends UserFacingError {}

const MSG = {
  unreadable: "バックアップファイルを読み込めませんでした（ファイルが壊れている可能性があります）",
  foreign: "このアプリのバックアップファイルではありません",
  newer: "新しいバージョンのアプリで作られたファイルです。アプリを更新してください",
  invalid: "ファイルの内容に誤りがあります",
  photo: "写真のデータが欠けています",
};

export interface ParsedPhoto {
  id: string;
  boardId: string;
  width: number;
  height: number;
  type: string;
  bytes: ArrayBuffer;
}

export interface ParsedBackup {
  boards: Board[];
  photos: ParsedPhoto[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Keeps only the known fields, so unknown (future) fields are ignored. */
const pickCell = (c: Cell): Cell => {
  const cell: Cell = { id: c.id, row: c.row, col: c.col, title: c.title, category: c.category };
  if (c.memo !== undefined) cell.memo = c.memo;
  if (c.photoId !== undefined) {
    cell.photoId = c.photoId;
    cell.crop = { cx: c.crop!.cx, cy: c.crop!.cy, zoom: c.crop!.zoom };
    cell.achievedAt = c.achievedAt;
  }
  return cell;
};

const pickBoard = (b: Board): Board => ({
  id: b.id,
  title: b.title,
  size: { cols: b.size.cols, rows: b.size.rows },
  cells: b.cells.map(pickCell),
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
});

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

/** Validates a backup file completely. Writes nothing (contracts/backup-format.md). */
export const parseBackup = async (text: string): Promise<ParsedBackup> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError(MSG.unreadable);
  }
  if (!isObject(json) || json.format !== BACKUP_FORMAT) throw new BackupError(MSG.foreign);
  if (!Number.isInteger(json.formatVersion) || (json.formatVersion as number) < 1)
    throw new BackupError(MSG.invalid);
  if ((json.formatVersion as number) > BACKUP_FORMAT_VERSION) throw new BackupError(MSG.newer);
  if (!Array.isArray(json.boards) || !Array.isArray(json.photos))
    throw new BackupError(MSG.invalid);

  const boardIds = new Set<string>();
  for (const b of json.boards) {
    if (validateBoard(b).length > 0) throw new BackupError(MSG.invalid);
    const id = (b as Board).id;
    if (boardIds.has(id)) throw new BackupError(MSG.invalid);
    boardIds.add(id);
  }
  const boards = (json.boards as Board[]).map(pickBoard);

  const photos = new Map<string, ParsedPhoto>();
  for (const p of json.photos) {
    if (
      !isObject(p) ||
      typeof p.id !== "string" ||
      typeof p.boardId !== "string" ||
      typeof p.dataUrl !== "string" ||
      !Number.isFinite(p.width) ||
      !Number.isFinite(p.height)
    )
      throw new BackupError(MSG.photo);
    const m = DATA_URL.exec(p.dataUrl);
    if (!m) throw new BackupError(MSG.photo);
    let bytes: ArrayBuffer;
    try {
      bytes = base64ToBytes(m[2]);
    } catch {
      throw new BackupError(MSG.photo);
    }
    photos.set(p.id, {
      id: p.id,
      boardId: p.boardId,
      width: p.width as number,
      height: p.height as number,
      type: m[1],
      bytes,
    });
  }
  for (const b of boards) {
    for (const c of b.cells) {
      if (!c.photoId) continue;
      const p = photos.get(c.photoId);
      if (!p || p.boardId !== b.id) throw new BackupError(MSG.photo);
    }
  }
  // Only keep photos that are referenced by a cell.
  const used = new Set(
    boards.flatMap((b) => b.cells.flatMap((c) => (c.photoId ? [c.photoId] : []))),
  );
  return { boards, photos: [...photos.values()].filter((p) => used.has(p.id)) };
};

/** Boards in the backup whose id already exists on this device. */
export const detectConflicts = (parsed: ParsedBackup, existingIds: readonly string[]) => {
  const existing = new Set(existingIds);
  return parsed.boards.filter((b) => existing.has(b.id));
};

export type Resolution = "overwrite" | "copy";

const RESTORED = "（復元）";
const restoredTitle = (title: string) =>
  [...title].slice(0, BOARD_TITLE_MAX - [...RESTORED].length).join("") + RESTORED;

/** Decodes the photo to check it and makes a fresh thumbnail. */
const defaultMakeThumb = async (blob: Blob) => (await importPhoto(blob)).thumbBlob;

export interface ApplyOptions {
  makeThumb?: (blob: Blob) => Promise<Blob>;
}

/**
 * Writes the backup in one transaction. Conflicting boards are overwritten or added as copies
 * with new ids, depending on `resolutions` (default: copy).
 */
export const applyBackup = async (
  parsed: ParsedBackup,
  resolutions: Record<string, Resolution>,
  opts: ApplyOptions = {},
) => {
  const makeThumb = opts.makeThumb ?? defaultMakeThumb;
  const db = await getDb();
  const existing = new Set(await db.getAllKeys("boards"));

  const boards: Board[] = [];
  const photos: Photo[] = [];
  const overwrite: string[] = [];
  const byId = new Map(parsed.photos.map((p) => [p.id, p]));

  for (const board of parsed.boards) {
    const conflict = existing.has(board.id);
    const copy = conflict && (resolutions[board.id] ?? "copy") === "copy";
    if (conflict && !copy) overwrite.push(board.id);
    const boardId = copy ? crypto.randomUUID() : board.id;
    const cells: Cell[] = [];
    for (const c of board.cells) {
      const cell = copy ? { ...c, id: crypto.randomUUID() } : { ...c };
      if (c.photoId) {
        const p = byId.get(c.photoId)!;
        const blob = new Blob([p.bytes], { type: p.type });
        let thumbBlob: Blob;
        try {
          thumbBlob = await makeThumb(blob);
        } catch {
          throw new BackupError(MSG.photo);
        }
        cell.photoId = copy ? crypto.randomUUID() : p.id;
        photos.push({
          id: cell.photoId,
          boardId,
          blob,
          thumbBlob,
          width: p.width,
          height: p.height,
        });
      }
      cells.push(cell);
    }
    boards.push({
      ...board,
      id: boardId,
      title: copy ? restoredTitle(board.title) : board.title,
      cells,
    });
  }

  const stored = await Promise.all(photos.map(toStored));
  await withQuotaGuard(async () => {
    const tx = db.transaction(["boards", "photos"], "readwrite");
    for (const id of overwrite) {
      await deletePhotosOfBoardInTx(tx, id);
      await tx.objectStore("boards").delete(id);
    }
    await Promise.all(stored.map((p) => tx.objectStore("photos").put(p)));
    await Promise.all(boards.map((b) => tx.objectStore("boards").put(b)));
    await tx.done;
  });
  releasePhotoUrls(photos.map((p) => p.id));
  return boards;
};
