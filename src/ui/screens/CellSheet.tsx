import { useEffect, useRef, useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { findCell } from "../../domain/grid";
import { CATEGORIES, type Board, type Category } from "../../domain/types";
import { CELL_TITLE_MAX, MEMO_MAX, validateCellInput } from "../../domain/validation";
import { confirm } from "../components/ConfirmDialog";
import { removeCell, upsertCell } from "../state/boardStore";
import { useDebounced } from "../useDebounced";
import { PhotoSection } from "./PhotoSection";

interface Props {
  board: Board;
  row: number;
  col: number;
}

export const CellSheet = ({ board, row, col }: Props) => {
  const cell = findCell(board, row, col);
  const [title, setTitle] = useState(cell?.title ?? "");
  const [category, setCategory] = useState<Category>(cell?.category ?? "want");
  const [memo, setMemo] = useState(cell?.memo ?? "");
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cell) titleRef.current?.focus();
  }, []);

  // Always save the latest values, so a delayed save never overwrites a newer change.
  const latest = useRef({ title, category, memo });
  latest.current = { title, category, memo };
  const save = () => {
    const next = latest.current;
    const msg = validateCellInput(next);
    setError(msg);
    if (!msg) void upsertCell(row, col, next);
  };
  const saveLater = useDebounced(save, 400);

  const close = () => navigate({ name: "board", boardId: board.id });

  const onDelete = async () => {
    const ok = await confirm({
      title: "項目を削除しますか？",
      message: cell?.photoId ? "貼った写真も削除されます。" : undefined,
      confirmLabel: "削除",
      danger: true,
    });
    if (!ok) return;
    await removeCell(row, col);
    close();
  };

  return (
    <div class="modal-backdrop" onClick={close}>
      <section
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        <div class="top-bar">
          <h2 id="cell-sheet-title" style={{ flex: 1, margin: 0 }}>
            {row + 1}行{col + 1}列{cell ? "" : "（新しい項目）"}
          </h2>
          <button type="button" class="btn" onClick={close}>
            閉じる
          </button>
        </div>

        <label class="field">
          <span class="field-label">やりたいこと</span>
          <input
            ref={titleRef}
            type="text"
            name="title"
            value={title}
            maxLength={CELL_TITLE_MAX}
            placeholder="例: 京都で抹茶パフェを食べる"
            aria-invalid={!!error}
            aria-describedby={error ? "cell-title-error" : undefined}
            onInput={(e) => {
              const v = e.currentTarget.value;
              setTitle(v);
              latest.current = { ...latest.current, title: v };
              saveLater();
            }}
          />
          {error && (
            <div id="cell-title-error" class="field-error" role="alert">
              {error}
            </div>
          )}
        </label>

        <fieldset class="field" style={{ border: "none", padding: 0 }}>
          <legend class="field-label">カテゴリ</legend>
          <div class="category-options" role="radiogroup" aria-label="カテゴリ">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={category === c.id}
                class="chip"
                style={{ color: c.color }}
                onClick={() => {
                  setCategory(c.id);
                  latest.current = { ...latest.current, category: c.id };
                  save();
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label class="field">
          <span class="field-label">メモ（任意）</span>
          <textarea
            name="memo"
            value={memo}
            maxLength={MEMO_MAX}
            onInput={(e) => {
              const v = e.currentTarget.value;
              setMemo(v);
              latest.current = { ...latest.current, memo: v };
              saveLater();
            }}
          />
        </label>

        {cell && <PhotoSection board={board} cell={cell} />}

        {cell && (
          <div class="section">
            <button type="button" class="btn btn-danger" onClick={onDelete}>
              項目を削除
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
