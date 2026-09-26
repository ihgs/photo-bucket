import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { inspectBackup, type ImportSource } from "../../backup/importBackup";
import {
  planImport,
  runImportPlan,
  type BoardResult,
  type BoardStatus,
  type ConflictAction,
  type ImportMode,
  type ImportOutcome,
  type ImportProgress,
} from "../../backup/importPlan";
import { reportError } from "../../app/errors";
import { confirm } from "./ConfirmDialog";

export interface FileError {
  name: string;
  message: string;
}

/** Inspects the chosen files; broken ones become errors instead of sources. */
export const inspectFiles = async (files: readonly File[]) => {
  const sources: ImportSource[] = [];
  const errors: FileError[] = [];
  for (const file of files) {
    try {
      sources.push(await inspectBackup(file));
    } catch (e) {
      errors.push({ name: file.name, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { sources, errors };
};

const STATUS_LABEL: Record<BoardStatus, string> = {
  added: "追加",
  overwritten: "上書き",
  copied: "別のボードとして追加",
  skipped: "読み込まなかった",
  failed: "読み込めなかった",
};

const Summary = ({ outcome }: { outcome: ImportOutcome }) => {
  const count = (s: BoardStatus) => outcome.results.filter((r) => r.status === s).length;
  const failed = outcome.results.filter((r): r is BoardResult & { reason: string } =>
    Boolean(r.status === "failed" && r.reason),
  );
  return (
    <>
      <ul class="import-summary">
        {(Object.keys(STATUS_LABEL) as BoardStatus[])
          .filter((s) => count(s) > 0)
          .map((s) => (
            <li key={s}>
              {STATUS_LABEL[s]} {count(s)} ボード
            </li>
          ))}
      </ul>
      {failed.length > 0 && (
        <ul class="import-failures">
          {failed.map((r, i) => (
            <li key={i}>
              {r.title} — {r.reason}
            </li>
          ))}
        </ul>
      )}
      {outcome.keptExisting && (
        <p>一部のボードを読み込めなかったため、端末にもともとあったボードは削除していません。</p>
      )}
    </>
  );
};

interface Props {
  sources: ImportSource[];
  errors: FileError[];
  existingIds: string[];
  onClose: () => void;
}

type Phase =
  | { name: "choosing" }
  | { name: "running"; progress: ImportProgress }
  | { name: "done"; outcome: ImportOutcome };

/** Reads backups: choose files and how to read them, show progress, then the result (contracts/backup-import.md). */
export const ImportDialog = (props: Props) => {
  const [sources, setSources] = useState(props.sources);
  const [errors, setErrors] = useState(props.errors);
  const [mode, setMode] = useState<ImportMode>("add");
  const [onConflict, setOnConflict] = useState<ConflictAction>("skip");
  const [phase, setPhase] = useState<Phase>({ name: "choosing" });
  const ref = useRef<HTMLDialogElement>(null);

  const plan = useMemo(
    () => planImport(sources, props.existingIds, mode, onConflict),
    [sources, props.existingIds, mode, onConflict],
  );

  useEffect(() => {
    ref.current?.focus();
  }, [phase.name]);

  const addFiles = async (files: File[]) => {
    const r = await inspectFiles(files);
    setSources((s) => [...s, ...r.sources]);
    setErrors(r.errors);
  };

  const start = async () => {
    if (mode === "replace") {
      const n = plan.deleteIds.length;
      const ok = await confirm({
        title: "すべて置き換えますか？",
        message:
          n > 0
            ? `端末にある ${n} 個のボードを削除し、バックアップの ${plan.items.length} 個のボードに置き換えます。削除したボードは元に戻せません。`
            : `バックアップの ${plan.items.length} 個のボードに置き換えます。端末のボードは削除されません。`,
        confirmLabel: "置き換える",
        cancelLabel: "戻る",
        danger: true,
      });
      if (!ok) return;
    }
    setPhase({ name: "running", progress: { done: 0, total: plan.items.length } });
    try {
      const outcome = await runImportPlan(plan, (progress) =>
        setPhase({ name: "running", progress }),
      );
      setPhase({ name: "done", outcome });
    } catch (e) {
      reportError(e, "バックアップを読み込めませんでした");
      props.onClose();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (phase.name !== "running") props.onClose();
  };

  return (
    <div class="modal-backdrop">
      <dialog
        ref={ref}
        open
        tabIndex={-1}
        class="confirm-dialog import-dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onKeyDown={onKeyDown}
      >
        {phase.name === "choosing" && (
          <>
            <h2 id="import-title">バックアップを読み込む</h2>
            <ul class="import-files">
              {sources.map((s, i) => (
                <li key={i}>
                  <span class="import-file-name">{s.name || "バックアップ"}</span>
                  <span class="muted">{s.boards.length} ボード</span>
                  <button
                    type="button"
                    class="btn btn-small"
                    aria-label={`${s.name}を外す`}
                    onClick={() => setSources(sources.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {errors.map((e, i) => (
              <p key={i} class="import-error" role="alert">
                {e.name}: {e.message}
              </p>
            ))}
            <label class="btn">
              ファイルを追加
              <input
                type="file"
                multiple
                class="visually-hidden"
                onChange={(e) => {
                  const input = e.currentTarget;
                  const files = [...(input.files ?? [])];
                  input.value = "";
                  if (files.length > 0) void addFiles(files);
                }}
              />
            </label>
            <p>
              {plan.items.length > 0
                ? `合計 ${plan.items.length} ボード`
                : "ボードが入っていません"}
            </p>

            <fieldset class="import-choice">
              <legend>読み込み方</legend>
              <label>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === "add"}
                  onChange={() => setMode("add")}
                />
                追加する
              </label>
              <label>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                />
                すべて置き換える
              </label>
            </fieldset>

            {mode === "add" && plan.conflicts > 0 && (
              <fieldset class="import-choice">
                <legend>端末にすでにある {plan.conflicts} 個のボード</legend>
                {(
                  [
                    ["overwrite", "上書きする"],
                    ["copy", "別のボードとして追加する"],
                    ["skip", "読み込まない"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="import-conflict"
                      checked={onConflict === value}
                      onChange={() => setOnConflict(value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}

            <div class="dialog-actions">
              <button type="button" class="btn" onClick={props.onClose}>
                キャンセル
              </button>
              <button
                type="button"
                class="btn btn-primary"
                disabled={plan.items.length === 0}
                onClick={() => void start()}
              >
                読み込む
              </button>
            </div>
          </>
        )}

        {phase.name === "running" && (
          <>
            <h2 id="import-title">読み込み中…</h2>
            <p aria-live="polite">
              {phase.progress.done} / {phase.progress.total} ボード
            </p>
            <progress max={phase.progress.total} value={phase.progress.done} />
            {phase.progress.current && <p class="muted">{phase.progress.current}</p>}
          </>
        )}

        {phase.name === "done" && (
          <>
            <h2 id="import-title">読み込みが終わりました</h2>
            <Summary outcome={phase.outcome} />
            <div class="dialog-actions">
              <button type="button" class="btn btn-primary" onClick={props.onClose}>
                閉じる
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
};
