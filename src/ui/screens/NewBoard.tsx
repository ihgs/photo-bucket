import { useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { reportError } from "../../app/errors";
import { DEFAULT_GRID_SIZE } from "../../domain/grid";
import type { GridSize } from "../../domain/types";
import { BOARD_TITLE_MAX, UNTITLED_BOARD } from "../../domain/validation";
import { createBoard } from "../../storage/boards";
import { SizePicker } from "../components/SizePicker";
import { openBoard } from "../state/boardStore";

export const NewBoard = () => {
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<GridSize>(DEFAULT_GRID_SIZE);
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    try {
      const board = await createBoard(title, size);
      await openBoard(board.id);
      navigate({ name: "board", boardId: board.id }, { replace: true });
    } catch (err) {
      reportError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div class="top-bar">
        <button
          type="button"
          class="btn btn-ghost"
          onClick={() => navigate({ name: "list" })}
          aria-label="戻る"
        >
          ←
        </button>
        <h1>新しいボード</h1>
      </div>
      <label class="field">
        <span class="field-label">タイトル</span>
        <input
          type="text"
          name="title"
          value={title}
          maxLength={BOARD_TITLE_MAX}
          placeholder={`例: 2026年やりたいこと（空欄なら「${UNTITLED_BOARD}」）`}
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
      </label>
      <fieldset class="field" style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
        <legend class="field-label">マス目のサイズ</legend>
        <SizePicker value={size} onChange={setSize} />
      </fieldset>
      <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
        ボードを作る
      </button>
    </form>
  );
};
