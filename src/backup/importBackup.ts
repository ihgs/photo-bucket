import { UserFacingError } from "../app/errors";
import type { Board, Cell, Photo } from "../domain/types";
import { BOARD_TITLE_MAX, validateBoard } from "../domain/validation";
import { importPhoto } from "../media/importPhoto";
import { getDb, withQuotaGuard } from "../storage/db";
import { deletePhotosOfBoardInTx, releasePhotoUrls, toStored } from "../storage/photos";
import { forgetExportInTx } from "./exportLog";
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, BACKUP_MANIFEST, isPhotoType } from "./format";
import { readZip, type ZipReader } from "./zip";

export class BackupError extends UserFacingError {}

const MSG = {
  unreadable: "バックアップファイルを読み込めませんでした（ファイルが壊れている可能性があります）",
  foreign: "このアプリのバックアップファイルではありません",
  newer: "新しいバージョンのアプリで作られたファイルです。アプリを更新してください",
  invalid: "ファイルの内容に誤りがあります",
  photo: "写真のデータが欠けています",
};

/** Where a photo of the backup is, without its bytes (data-model.md ImportSource). */
export interface ImportPhotoInfo {
  id: string;
  boardId: string;
  width: number;
  height: number;
  type: string;
  path: string;
}

/** A checked backup file. Photo bytes are read later, one board at a time (research.md R1). */
export interface ImportSource {
  name: string;
  zip: ZipReader;
  boards: Board[];
  photos: Map<string, ImportPhotoInfo>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Keeps only the known fields, so unknown (future) fields are ignored. */
const pickCell = (c: Cell): Cell => {
  const cell: Cell = { id: c.id, row: c.row, col: c.col, title: c.title, category: c.category };
  if (c.memo !== undefined) cell.memo = c.memo;
  if (c.photoId !== undefined) {
    cell.photoId = c.photoId;
    cell.crop = { cx: c.crop!.cx, cy: c.crop!.cy, zoom: c.crop!.zoom };
    if (c.crop!.rotation) cell.crop.rotation = c.crop!.rotation;
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

/** Reads a ZIP entry; a broken ZIP becomes the "unreadable" error. */
const readEntry = async (zip: ZipReader, name: string) => {
  try {
    return await zip.read(name);
  } catch {
    throw new BackupError(MSG.unreadable);
  }
};

/**
 * Validates a .pbz backup file: the manifest, every board and that every referenced photo has an
 * entry. Photo bytes are not read here. Writes nothing (contracts/backup-format.md).
 */
export const inspectBackup = async (
  file: Blob,
  name = (file as File).name ?? "",
): Promise<ImportSource> => {
  let zip: ZipReader;
  try {
    zip = await readZip(file);
  } catch {
    throw new BackupError(MSG.unreadable);
  }
  const manifest = await readEntry(zip, BACKUP_MANIFEST);
  if (!manifest) throw new BackupError(MSG.foreign);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifest));
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

  const entries = new Map<string, ImportPhotoInfo>();
  for (const p of json.photos) {
    if (
      !isObject(p) ||
      typeof p.id !== "string" ||
      typeof p.boardId !== "string" ||
      typeof p.type !== "string" ||
      typeof p.path !== "string" ||
      !isPhotoType(p.type) ||
      !Number.isFinite(p.width) ||
      !Number.isFinite(p.height)
    )
      throw new BackupError(MSG.photo);
    entries.set(p.id, {
      id: p.id,
      boardId: p.boardId,
      width: p.width as number,
      height: p.height as number,
      type: p.type,
      path: p.path,
    });
  }
  const names = new Set(zip.names());
  const photos = new Map<string, ImportPhotoInfo>();
  for (const b of boards) {
    for (const c of b.cells) {
      if (!c.photoId) continue;
      const p = entries.get(c.photoId);
      if (!p || p.boardId !== b.id || !names.has(p.path)) throw new BackupError(MSG.photo);
      photos.set(p.id, p);
    }
  }
  return { name, zip, boards, photos };
};

/** What to do with one board of the backup. */
export type BoardAction = "add" | "overwrite" | "copy";

const RESTORED = "（復元）";
const restoredTitle = (title: string) =>
  [...title].slice(0, BOARD_TITLE_MAX - [...RESTORED].length).join("") + RESTORED;

/** Decodes the photo to check it and makes a fresh thumbnail. */
const defaultMakeThumb = async (blob: Blob) => (await importPhoto(blob)).thumbBlob;

export interface ImportBoardOptions {
  makeThumb?: (blob: Blob) => Promise<Blob>;
}

/**
 * Writes one board of the backup in one transaction: all of it or nothing (FR-001). Only this
 * board's photos are read. "overwrite" replaces the board with the same id; "copy" adds it with
 * new ids and "（復元）" appended to the title. Returns the board as written.
 */
export const importBoard = async (
  source: ImportSource,
  board: Board,
  action: BoardAction,
  opts: ImportBoardOptions = {},
): Promise<Board> => {
  const makeThumb = opts.makeThumb ?? defaultMakeThumb;
  const copy = action === "copy";
  const boardId = copy ? crypto.randomUUID() : board.id;
  const cells: Cell[] = [];
  const photos: Photo[] = [];
  for (const c of board.cells) {
    const cell = copy ? { ...c, id: crypto.randomUUID() } : { ...c };
    if (c.photoId) {
      const p = source.photos.get(c.photoId)!;
      const bytes = await readEntry(source.zip, p.path);
      if (!bytes) throw new BackupError(MSG.photo);
      const blob = new Blob([bytes], { type: p.type });
      let thumbBlob: Blob;
      try {
        thumbBlob = await makeThumb(blob);
      } catch {
        throw new BackupError(MSG.photo);
      }
      cell.photoId = copy ? crypto.randomUUID() : p.id;
      photos.push({ id: cell.photoId, boardId, blob, thumbBlob, width: p.width, height: p.height });
    }
    cells.push(cell);
  }
  const saved: Board = {
    ...board,
    id: boardId,
    title: copy ? restoredTitle(board.title) : board.title,
    cells,
  };

  const stored = await Promise.all(photos.map(toStored));
  await withQuotaGuard(async () => {
    const db = await getDb();
    const tx = db.transaction(["boards", "photos", "meta"], "readwrite");
    try {
      if (action === "overwrite") await deletePhotosOfBoardInTx(tx, board.id);
      await Promise.all(stored.map((p) => tx.objectStore("photos").put(p)));
      await tx.objectStore("boards").put(saved);
      await forgetExportInTx(tx, [boardId]);
      await tx.done;
    } catch (e) {
      // Never leave half a board behind (FR-001).
      try {
        tx.abort();
      } catch {
        // already finished
      }
      await tx.done.catch(() => undefined);
      throw e;
    }
  });
  releasePhotoUrls(photos.map((p) => p.id));
  return saved;
};
