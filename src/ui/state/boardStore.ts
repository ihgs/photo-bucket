import { signal } from "@preact/signals";
import * as grid from "../../domain/grid";
import type { Board, Crop, GridSize } from "../../domain/types";
import { importPhoto } from "../../media/importPhoto";
import { newPhotoRecord, primePhotoUrls } from "../../storage/photos";
import { normalizeBoardTitle } from "../../domain/validation";
import { getBoard, saveBoard, type SaveOptions } from "../../storage/boards";
import { updatePreferences } from "../../storage/preferences";
import { reportError } from "../../app/errors";

/** The board currently open on screen. */
export const currentBoard = signal<Board | null>(null);

let queue: Promise<unknown> = Promise.resolve();

/**
 * Shows `next` immediately and saves it (FR-019). Saves run one after another; if a save fails the
 * screen goes back to the previous state and the user is told why.
 */
export const commit = (next: Board, opts: SaveOptions = {}): Promise<boolean> => {
  const prev = currentBoard.value;
  currentBoard.value = next;
  const run = queue.then(async () => {
    try {
      const saved = await saveBoard(next, opts);
      if (currentBoard.value === next) currentBoard.value = saved;
      return true;
    } catch (e) {
      if (currentBoard.value === next) currentBoard.value = prev;
      reportError(e);
      return false;
    }
  });
  queue = run.catch(() => undefined);
  return run;
};

/** Waits until all pending saves have finished. */
export const flushSaves = () => queue;

export const openBoard = async (id: string): Promise<Board | undefined> => {
  if (currentBoard.value?.id === id) return currentBoard.value;
  const board = await getBoard(id);
  currentBoard.value = board ?? null;
  if (board) void updatePreferences({ lastOpenedBoardId: id }).catch(() => undefined);
  return board;
};

export const closeBoard = () => {
  currentBoard.value = null;
};

const withBoard = (fn: (b: Board) => Promise<boolean>) => {
  const b = currentBoard.value;
  return b ? fn(b) : Promise.resolve(false);
};

export const updateTitle = (title: string) =>
  withBoard((b) => commit({ ...b, title: normalizeBoardTitle(title) }));

export const upsertCell = (row: number, col: number, edit: grid.CellEdit) =>
  withBoard((b) => commit(grid.upsertCell(b, row, col, edit)));

export const removeCell = (row: number, col: number) =>
  withBoard((b) => {
    const r = grid.removeCell(b, row, col);
    return commit(r.board, { deletePhotoIds: r.removedPhotoIds });
  });

export const swapCells = (a: grid.Position, bPos: grid.Position) =>
  withBoard((b) => commit(grid.swapCells(b, a, bPos)));

export const resize = (size: GridSize) =>
  withBoard((b) => {
    const r = grid.resizeBoard(b, size);
    return commit(r.board, { deletePhotoIds: r.removedPhotoIds });
  });

// ---- photos (User Story 2) ----

export const attachPhoto = async (row: number, col: number, file: Blob) => {
  const b = currentBoard.value;
  if (!b) return false;
  const imported = await importPhoto(file); // throws a user-facing error for unreadable files
  const photo = newPhotoRecord(b.id, imported);
  primePhotoUrls(photo);
  const latest = currentBoard.value ?? b;
  const r = grid.setCellPhoto(latest, row, col, photo.id);
  return commit(r.board, { putPhotos: [photo], deletePhotoIds: r.removedPhotoIds });
};

export const detachPhoto = (row: number, col: number) =>
  withBoard((b) => {
    const r = grid.clearCellPhoto(b, row, col);
    return commit(r.board, { deletePhotoIds: r.removedPhotoIds });
  });

export const setCrop = (row: number, col: number, crop: Crop) =>
  withBoard((b) => commit(grid.setCellCrop(b, row, col, crop)));
