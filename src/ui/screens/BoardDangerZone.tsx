import { navigate } from "../../app/router";
import type { Board } from "../../domain/types";
import { runExport } from "../backupActions";
import { confirmDeleteBoard } from "./BoardList";

export const BoardDangerZone = ({ board }: { board: Board }) => (
  <section class="section">
    <h2>このボードのデータ</h2>
    <div class="btn-row">
      <button type="button" class="btn" onClick={() => void runExport([board.id])}>
        このボードだけ書き出す
      </button>
      <button
        type="button"
        class="btn btn-danger"
        onClick={async () => {
          if (await confirmDeleteBoard(board)) navigate({ name: "list" }, { replace: true });
        }}
      >
        このボードを削除
      </button>
    </div>
  </section>
);
