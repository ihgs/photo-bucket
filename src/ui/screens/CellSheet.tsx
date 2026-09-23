import { Pencil } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { findCell } from "../../domain/grid";
import { CATEGORIES, type Board, type Category } from "../../domain/types";
import { CELL_TITLE_MAX, MEMO_MAX, validateCellInput } from "../../domain/validation";
import { CategoryBadge } from "../components/CategoryBadge";
import { confirm } from "../components/ConfirmDialog";
import { removeCell, upsertCell } from "../state/boardStore";
import { useDebounced } from "../useDebounced";
import { useVisualViewport } from "../useVisualViewport";
import { PhotoSection } from "./PhotoSection";
import { IconButton } from "../components/IconButton";

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
  // A cell that already has a title opens read-only (#9); a new one opens the form as before.
  const [canView] = useState(!!cell);
  const [editing, setEditing] = useState(!cell);
  const titleRef = useRef<HTMLInputElement>(null);
  const backdropRef = useVisualViewport<HTMLDivElement>();

  useEffect(() => {
    if (editing) titleRef.current?.focus();
  }, [editing]);

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

  const finishEditing = () => {
    const msg = validateCellInput(latest.current);
    setError(msg);
    if (msg) return;
    saveLater.cancel();
    void upsertCell(row, col, latest.current);
    setEditing(false);
  };

  const close = () => navigate({ name: "board", boardId: board.id });

  const onDelete = async () => {
    const ok = await confirm({
      title: "項目を削除しますか？",
      message: cell?.photoId ? "貼った写真も削除されます。" : undefined,
      confirmLabel: "削除",
      danger: true,
    });
    if (!ok) return;
    saveLater.cancel(); // a pending save would bring the item back
    await removeCell(row, col);
    close();
  };

  const memoField = (
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
  );

  return (
    <div class="modal-backdrop" ref={backdropRef} onClick={close}>
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
          {cell && canView && !editing && (
            <IconButton
              icon={Pencil}
              label="やりたいこととカテゴリを編集"
              onClick={() => setEditing(true)}
            />
          )}
          {canView && editing && (
            <button type="button" class="btn btn-primary" onClick={finishEditing}>
              完了
            </button>
          )}
          <button type="button" class="btn" onClick={close}>
            閉じる
          </button>
        </div>

        {cell && canView && !editing ? (
          <>
            <div class="cell-view-heading">
              <p class="cell-view-title">{cell.title}</p>
              <CategoryBadge category={cell.category} />
            </div>
            <PhotoSection board={board} cell={cell} />
            <div class="section">{memoField}</div>
          </>
        ) : (
          <>
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

            {memoField}

            {cell && !canView && <PhotoSection board={board} cell={cell} />}

            {cell && (
              <div class="section">
                <button type="button" class="btn btn-danger" onClick={onDelete}>
                  項目を削除
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
