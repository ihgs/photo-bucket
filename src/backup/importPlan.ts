import type { Board } from "../domain/types";
import { getDb, StorageFullError, withQuotaGuard } from "../storage/db";
import { deletePhotosOfBoardInTx } from "../storage/photos";
import { forgetExportInTx } from "./exportLog";
import { UserFacingError } from "../app/errors";
import {
  importBoard,
  type BoardAction,
  type ImportBoardOptions,
  type ImportSource,
} from "./importBackup";

export type ImportMode = "add" | "replace";
/** What to do with boards that already exist on this device, when adding. */
export type ConflictAction = "overwrite" | "copy" | "skip";

export interface ImportItem {
  source: ImportSource;
  board: Board;
  action: BoardAction | "skip";
}

export interface ImportPlan {
  mode: ImportMode;
  items: ImportItem[];
  /** Boards of the backup that already exist on this device. */
  conflicts: number;
  /** Boards on this device that "replace" deletes once every board is written. */
  deleteIds: string[];
}

export type BoardStatus = "added" | "overwritten" | "copied" | "skipped" | "failed";

export interface BoardResult {
  title: string;
  status: BoardStatus;
  reason?: string;
}

export interface ImportOutcome {
  results: BoardResult[];
  /** "replace" left the device's other boards in place because some board failed (FR-007). */
  keptExisting: boolean;
}

export interface ImportProgress {
  done: number;
  total: number;
  /** Title of the board being read; undefined once all are done. */
  current?: string;
}

/**
 * Merges the boards of all sources (the newest `updatedAt` wins; on a tie the later source) and
 * decides what happens to each one (data-model.md ImportPlan).
 */
export const planImport = (
  sources: readonly ImportSource[],
  existingIds: readonly string[],
  mode: ImportMode,
  onConflict: ConflictAction = "skip",
): ImportPlan => {
  const picked = new Map<string, { source: ImportSource; board: Board }>();
  for (const source of sources)
    for (const board of source.boards) {
      const prev = picked.get(board.id);
      if (!prev || board.updatedAt >= prev.board.updatedAt) picked.set(board.id, { source, board });
    }
  const existing = new Set(existingIds);
  let conflicts = 0;
  const items = [...picked.values()].map(({ source, board }): ImportItem => {
    if (!existing.has(board.id)) return { source, board, action: "add" };
    conflicts++;
    const action = mode === "replace" || onConflict === "overwrite" ? "overwrite" : onConflict;
    return { source, board, action };
  });
  const deleteIds = mode === "replace" ? existingIds.filter((id) => !picked.has(id)) : [];
  return { mode, items, conflicts, deleteIds };
};

const STATUS: Record<BoardAction, BoardStatus> = {
  add: "added",
  overwrite: "overwritten",
  copy: "copied",
};

const STORAGE_FULL = new StorageFullError().message;
const reasonOf = (e: unknown) =>
  e instanceof UserFacingError ? e.message : "読み込めませんでした";

/** Writes the plan one board at a time (research.md R1). A failed board does not stop the rest. */
export const runImportPlan = async (
  plan: ImportPlan,
  onProgress?: (p: ImportProgress) => void,
  opts: ImportBoardOptions = {},
): Promise<ImportOutcome> => {
  const total = plan.items.length;
  const results: BoardResult[] = [];
  let full = false;
  for (const [i, item] of plan.items.entries()) {
    const title = item.board.title;
    if (full) {
      results.push({ title, status: "failed", reason: STORAGE_FULL });
      continue;
    }
    onProgress?.({ done: i, total, current: title });
    if (item.action === "skip") {
      results.push({ title, status: "skipped" });
      continue;
    }
    try {
      await importBoard(item.source, item.board, item.action, opts);
      results.push({ title, status: STATUS[item.action] });
    } catch (e) {
      if (e instanceof StorageFullError) {
        full = true;
        results.push({ title, status: "failed", reason: STORAGE_FULL });
      } else {
        results.push({ title, status: "failed", reason: reasonOf(e) });
      }
    }
  }
  const failed = results.some((r) => r.status === "failed");
  // "replace" deletes the device's other boards last, and only when every board was written, so
  // no failure can lose a board (research.md R3).
  if (!failed && plan.deleteIds.length > 0) await deleteBoards(plan.deleteIds);
  onProgress?.({ done: total, total });
  return { results, keptExisting: failed && plan.deleteIds.length > 0 };
};

const deleteBoards = (ids: readonly string[]) =>
  withQuotaGuard(async () => {
    const tx = (await getDb()).transaction(["boards", "photos", "meta"], "readwrite");
    for (const id of ids) {
      await deletePhotosOfBoardInTx(tx, id);
      await tx.objectStore("boards").delete(id);
    }
    await forgetExportInTx(tx, ids);
    await tx.done;
  });
