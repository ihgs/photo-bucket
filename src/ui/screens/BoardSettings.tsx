import { useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { cellsOutside, gridLabel } from "../../domain/grid";
import type { Board, GridSize } from "../../domain/types";
import { BOARD_TITLE_MAX } from "../../domain/validation";
import { confirm } from "../components/ConfirmDialog";
import { SizePicker } from "../components/SizePicker";
import { resize, updateTitle } from "../state/boardStore";
import { useDebounced } from "../useDebounced";
import { BoardDangerZone } from "./BoardDangerZone";

export const BoardSettings = ({ board }: { board: Board }) => {
  const [title, setTitle] = useState(board.title);
  const saveTitle = useDebounced((t: string) => void updateTitle(t), 400);

  const changeSize = async (size: GridSize) => {
    if (size.cols === board.size.cols && size.rows === board.size.rows) return;
    const lost = cellsOutside(board, size);
    if (lost.length > 0) {
      const withPhoto = lost.filter((c) => c.photoId).length;
      const ok = await confirm({
        title: `マス目を ${gridLabel(size)} に変更しますか？`,
        message: `${lost.length} 件の項目（うち写真付き ${withPhoto} 件）が削除されます。`,
        confirmLabel: "変更して削除",
        danger: true,
      });
      if (!ok) return;
    }
    await resize(size);
  };

  return (
    <>
      <div class="top-bar">
        <button
          type="button"
          class="btn btn-ghost"
          aria-label="ボードへ戻る"
          onClick={() => navigate({ name: "board", boardId: board.id })}
        >
          ←
        </button>
        <h1>ボードの設定</h1>
      </div>
      <label class="field">
        <span class="field-label">タイトル</span>
        <input
          type="text"
          name="title"
          value={title}
          maxLength={BOARD_TITLE_MAX}
          onInput={(e) => {
            setTitle(e.currentTarget.value);
            saveTitle(e.currentTarget.value);
          }}
        />
      </label>
      <fieldset class="field" style={{ border: "none", padding: 0 }}>
        <legend class="field-label">マス目のサイズ（現在 {gridLabel(board.size)}）</legend>
        <SizePicker value={board.size} onChange={changeSize} />
      </fieldset>
      <BoardDangerZone board={board} />
    </>
  );
};
