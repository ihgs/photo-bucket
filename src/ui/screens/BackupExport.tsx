import { ArrowLeft } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { estimateBackupSize } from "../../backup/exportBackup";
import { exportStateOf, getExportLog, sortForExport, type ExportLog } from "../../backup/exportLog";
import { BACKUP_MAX_BOARDS } from "../../backup/format";
import type { Board } from "../../domain/types";
import { listBoards } from "../../storage/boards";
import { runExport } from "../backupActions";
import { IconButton } from "../components/IconButton";

const MB = 1000 * 1000;
export const formatSize = (bytes: number) =>
  bytes < MB ? "1MB 未満" : `約 ${Math.round(bytes / MB)}MB`;

const LIMIT_MESSAGE = `1 回に書き出せるのは ${BACKUP_MAX_BOARDS} ボードまでです`;

const stateLabel = (board: Board, log: ExportLog) => {
  const state = exportStateOf(board, log);
  if (state === "never") return "未書き出し";
  if (state === "changed") return "変更あり";
  const d = new Date(log[board.id]);
  return `${d.getMonth() + 1}月${d.getDate()}日に書き出し`;
};

interface Loaded {
  boards: Board[];
  log: ExportLog;
  sizes: Record<string, number>;
}

/** Chooses up to 10 boards and writes them to one backup file (contracts/backup-export.md). */
export const BackupExport = () => {
  const [data, setData] = useState<Loaded | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limitHit, setLimitHit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (initial: boolean) => {
    const [all, log] = await Promise.all([listBoards(), getExportLog()]);
    if (all.length === 0) {
      navigate({ name: "list" }, { replace: true });
      return;
    }
    const boards = sortForExport(all, log);
    const { perBoard } = await estimateBackupSize(boards.map((b) => b.id));
    setData({ boards, log, sizes: perBoard });
    if (!initial) {
      // With more than 10 boards, the next batch is picked from scratch.
      if (boards.length > BACKUP_MAX_BOARDS) setSelected(new Set());
      return;
    }
    if (boards.length <= BACKUP_MAX_BOARDS) setSelected(new Set(boards.map((b) => b.id)));
  };

  useEffect(() => {
    void load(true);
  }, []);

  if (!data) return <p class="muted">読み込み中…</p>;

  const many = data.boards.length > BACKUP_MAX_BOARDS;
  const ids = data.boards.map((b) => b.id).filter((id) => selected.has(id));
  const total = ids.reduce((n, id) => n + (data.sizes[id] ?? 0), 0);
  const full = selected.size >= BACKUP_MAX_BOARDS;

  const toggle = (id: string, e: Event) => {
    if (!selected.has(id) && full) {
      e.preventDefault();
      setLimitHit(id);
      return;
    }
    setLimitHit(null);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onExport = async () => {
    setBusy(true);
    try {
      if (await runExport(ids)) await load(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="backup-export">
      <div class="top-bar">
        <IconButton
          icon={ArrowLeft}
          label="ボード一覧へ"
          onClick={() => navigate({ name: "list" })}
        />
        <h1>バックアップを書き出す</h1>
      </div>
      {many && <p>{LIMIT_MESSAGE}</p>}
      <div class="btn-row">
        {!many && (
          <button
            type="button"
            class="btn"
            onClick={() => setSelected(new Set(data.boards.map((b) => b.id)))}
          >
            すべて選択
          </button>
        )}
        <button
          type="button"
          class="btn"
          onClick={() => {
            setSelected(new Set());
            setLimitHit(null);
          }}
        >
          すべて解除
        </button>
      </div>
      <ul class="export-list">
        {data.boards.map((b) => {
          const checked = selected.has(b.id);
          return (
            <li key={b.id}>
              <label class="export-row">
                <input
                  type="checkbox"
                  checked={checked}
                  aria-disabled={!checked && full ? "true" : undefined}
                  onClick={(e) => toggle(b.id, e)}
                />
                <span class="export-row-title">{b.title}</span>
                <span class="muted">{formatSize(data.sizes[b.id] ?? 0)}</span>
                <span class="export-state">{stateLabel(b, data.log)}</span>
              </label>
              {limitHit === b.id && (
                <p class="export-limit" role="status">
                  {LIMIT_MESSAGE}。残りは別に書き出してください
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div class="export-bar">
        <span aria-live="polite">
          {ids.length} ボード・{formatSize(total)}
        </span>
        <button
          type="button"
          class="btn btn-primary"
          disabled={ids.length === 0 || busy}
          onClick={() => void onExport()}
        >
          書き出す
        </button>
      </div>
    </div>
  );
};
