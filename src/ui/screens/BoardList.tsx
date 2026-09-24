import { useEffect, useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { reportError } from "../../app/errors";
import { countAchieved, gridLabel, totalCells } from "../../domain/grid";
import type { Board } from "../../domain/types";
import { deleteBoard, listBoards } from "../../storage/boards";
import { confirm } from "../components/ConfirmDialog";
import { showToast } from "../components/Toast";
import { runExport, runImport } from "../backupActions";
import { usePhotoUrl } from "../usePhotoUrl";
import { closeBoard, currentBoard } from "../state/boardStore";

const BoardThumb = ({ board }: { board: Board }) => {
  const first = board.cells.find((c) => c.photoId);
  const thumb = usePhotoUrl(first?.photoId, "thumb");
  return (
    <span
      class="board-thumb"
      aria-hidden="true"
      style={thumb ? { backgroundImage: `url("${thumb.url}")` } : undefined}
    />
  );
};

export const confirmDeleteBoard = async (board: Board) => {
  const photos = board.cells.filter((c) => c.photoId).length;
  const ok = await confirm({
    title: `「${board.title}」を削除しますか？`,
    message: `このボードと写真 ${photos} 枚が削除されます。元に戻せません。`,
    confirmLabel: "削除",
    danger: true,
  });
  if (!ok) return false;
  try {
    await deleteBoard(board.id);
    if (currentBoard.value?.id === board.id) closeBoard();
    showToast("ボードを削除しました");
    return true;
  } catch (e) {
    reportError(e, "削除できませんでした");
    return false;
  }
};

const ImportButton = ({ onDone }: { onDone: () => void }) => (
  <label class="btn">
    バックアップを読み込む
    <input
      type="file"
      accept=".json,application/json"
      class="visually-hidden"
      onChange={async (e) => {
        const input = e.currentTarget;
        const file = input.files?.[0];
        input.value = "";
        if (file && (await runImport(file))) onDone();
      }}
    />
  </label>
);

export const BoardList = () => {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const reload = () => void listBoards().then(setBoards);

  useEffect(reload, []);

  if (boards === null) return <p class="muted">読み込み中…</p>;

  if (boards.length === 0) {
    return (
      <div class="empty-state">
        <h1>フォトバケットリスト</h1>
        <p class="muted">やりたいことをマス目に書いて、達成したら写真を貼りましょう。</p>
        <section class="usage" aria-labelledby="usage-heading">
          <h2 id="usage-heading">使い方</h2>
          <ol class="usage-steps">
            <li>ボードを作る</li>
            <li>マスにやりたいことを書く</li>
            <li>達成したら写真を貼る</li>
            <li>全マス達成したら一枚の画像として保存・共有する</li>
          </ol>
        </section>
        <p>
          <button type="button" class="btn btn-primary" onClick={() => navigate({ name: "new" })}>
            最初のボードを作る
          </button>
        </p>
        <ImportButton onDone={reload} />
      </div>
    );
  }

  return (
    <>
      <div class="top-bar">
        <h1>フォトバケットリスト</h1>
        <button type="button" class="btn btn-primary" onClick={() => navigate({ name: "new" })}>
          ＋ 新しいボード
        </button>
      </div>
      <ul class="board-list">
        {boards.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              class="board-item"
              onClick={() => navigate({ name: "board", boardId: b.id })}
            >
              <BoardThumb board={b} />
              <span class="board-item-body">
                <span class="board-item-title">{b.title}</span>
                <span class="muted">
                  {gridLabel(b.size)}・{countAchieved(b)}/{totalCells(b.size)} 達成
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <section class="section" aria-labelledby="backup-heading">
        <h2 id="backup-heading">バックアップ</h2>
        <p class="muted">
          データはこの端末の中だけに保存されています。機種変更やブラウザのデータ消去に備えて、ときどき書き出しておきましょう。
        </p>
        <div class="btn-row">
          <button type="button" class="btn" onClick={() => void runExport()}>
            バックアップを書き出す
          </button>
          <ImportButton onDone={reload} />
        </div>
      </section>
    </>
  );
};
