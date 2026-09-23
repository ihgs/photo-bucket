import { ArrowLeft, Settings } from "lucide-preact";
import { useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { countAchieved, totalCells } from "../../domain/grid";
import type { Board } from "../../domain/types";
import { GridView } from "../components/GridView";
import { swapCells } from "../state/boardStore";
import { PhotoInCell } from "../components/PhotoInCell";
import { IconButton } from "../components/IconButton";

type MoveState = { active: false } | { active: true; from: { row: number; col: number } | null };

export const BoardView = ({ board }: { board: Board }) => {
  const [move, setMove] = useState<MoveState>({ active: false });

  const onCellClick = (row: number, col: number) => {
    if (!move.active) {
      navigate({ name: "cell", boardId: board.id, row, col });
      return;
    }
    if (!move.from) {
      setMove({ active: true, from: { row, col } });
      return;
    }
    const from = move.from;
    setMove({ active: true, from: null });
    if (from.row !== row || from.col !== col) void swapCells(from, { row, col });
  };

  const achieved = countAchieved(board);
  const total = totalCells(board.size);

  return (
    <>
      <div class="top-bar">
        <IconButton
          icon={ArrowLeft}
          label="ボード一覧へ"
          onClick={() => navigate({ name: "list" })}
        />
        <h1>{board.title}</h1>
        <IconButton
          icon={Settings}
          label="ボードの設定"
          onClick={() => navigate({ name: "settings", boardId: board.id })}
        />
      </div>
      <div class="progress-line">
        <span class="progress-count" aria-live="polite">
          {achieved}/{total} 達成
        </span>
        {move.active ? (
          <span class="btn-row">
            <span class="move-hint" role="status">
              {move.from ? "移動先を選んでください" : "移動元を選んでください"}
            </span>
            <button type="button" class="btn" onClick={() => setMove({ active: false })}>
              完了
            </button>
          </span>
        ) : (
          <span class="btn-row">
            <button type="button" class="btn" onClick={() => setMove({ active: true, from: null })}>
              移動
            </button>
            {achieved === total && (
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => navigate({ name: "export", boardId: board.id })}
              >
                画像として保存
              </button>
            )}
          </span>
        )}
      </div>
      <GridView
        board={board}
        onCellClick={onCellClick}
        selected={move.active ? move.from : null}
        renderPhoto={(c) => (c.cell?.photoId ? <PhotoInCell cell={c.cell} size={c.size} /> : null)}
      />
    </>
  );
};
