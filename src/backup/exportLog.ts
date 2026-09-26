import type { Board } from "../domain/types";
import { getDb, withQuotaGuard, type WriteTx } from "../storage/db";
import { BACKUP_MAX_BOARDS } from "./format";

/** When each board was last exported from this device (data-model.md). Not part of backups. */
export type ExportLog = Record<string, string>;

export type ExportState = "never" | "changed" | "stale" | "fresh";

export const BACKUP_REMIND_DAYS = 30;
const REMIND_MS = BACKUP_REMIND_DAYS * 24 * 60 * 60 * 1000;
const KEY = "exportLog";

export const exportStateOf = (board: Board, log: ExportLog, now = Date.now()): ExportState => {
  const at = log[board.id];
  if (!at) return "never";
  if (board.updatedAt > at) return "changed";
  if (now - Date.parse(at) >= REMIND_MS) return "stale";
  return "fresh";
};

/** True when a board with photos was never exported, changed since, or is 30+ days old. */
export const needsReminder = (
  boards: readonly Board[],
  withPhotos: ReadonlySet<string>,
  log: ExportLog,
  now = Date.now(),
) => boards.some((b) => withPhotos.has(b.id) && exportStateOf(b, log, now) !== "fresh");

export const getExportLog = async (): Promise<ExportLog> =>
  ((await (await getDb()).get("meta", KEY)) as ExportLog | undefined) ?? {};

export const recordExport = (boardIds: readonly string[], at = new Date().toISOString()) =>
  withQuotaGuard(async () => {
    const tx = (await getDb()).transaction("meta", "readwrite");
    const log = ((await tx.store.get(KEY)) as ExportLog | undefined) ?? {};
    for (const id of boardIds) log[id] = at;
    await tx.store.put(log, KEY);
    await tx.done;
  });

/** Drops the records of the given boards inside a transaction that includes "meta". */
export const forgetExportInTx = async (tx: WriteTx, boardIds: readonly string[]) => {
  if (boardIds.length === 0) return;
  const meta = tx.objectStore("meta");
  const log = (await meta.get(KEY)) as ExportLog | undefined;
  if (!log || !boardIds.some((id) => id in log)) return;
  for (const id of boardIds) delete log[id];
  await meta.put(log, KEY);
};

const RANK: Record<ExportState, number> = { never: 0, changed: 1, stale: 2, fresh: 2 };

/**
 * Export screen order (FR-020). Up to 10 boards keep the given order (the board list's). With more,
 * never-exported boards come first, then changed ones, then the oldest exports; ties keep the given
 * order.
 */
export const sortForExport = (boards: readonly Board[], log: ExportLog, now = Date.now()) => {
  if (boards.length <= BACKUP_MAX_BOARDS) return [...boards];
  const keyed = boards.map((b, i) => ({ b, i, rank: RANK[exportStateOf(b, log, now)] }));
  keyed.sort(
    (x, y) =>
      x.rank - y.rank ||
      (x.rank === 2 ? (log[x.b.id] < log[y.b.id] ? -1 : log[x.b.id] > log[y.b.id] ? 1 : 0) : 0) ||
      x.i - y.i,
  );
  return keyed.map((k) => k.b);
};

/** Boards the backup reminder asks for, in the given order, at most 10 (FR-019). */
export const pendingSelection = (
  boards: readonly Board[],
  withPhotos: ReadonlySet<string>,
  log: ExportLog,
  now = Date.now(),
) =>
  boards
    .filter((b) => withPhotos.has(b.id) && exportStateOf(b, log, now) !== "fresh")
    .slice(0, BACKUP_MAX_BOARDS)
    .map((b) => b.id);
