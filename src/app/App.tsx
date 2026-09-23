import { useEffect, useState } from "preact/hooks";
import { currentRoute, navigate, type Route } from "./router";
import { isInside } from "../domain/grid";
import { getPreferences } from "../storage/preferences";
import { Toasts, showToast } from "../ui/components/Toast";
import { ConfirmDialogHost } from "../ui/components/ConfirmDialog";
import { currentBoard, openBoard } from "../ui/state/boardStore";
import { BoardList } from "../ui/screens/BoardList";
import { NewBoard } from "../ui/screens/NewBoard";
import { BoardView } from "../ui/screens/BoardView";
import { CellSheet } from "../ui/screens/CellSheet";
import { BoardSettings } from "../ui/screens/BoardSettings";
import { CropEditor } from "../ui/screens/CropEditor";
import { ExportDialog } from "../ui/screens/ExportDialog";
import { AppBanners } from "./AppBanners";

const boardIdOf = (r: Route) => ("boardId" in r ? r.boardId : null);

let launched = false;

/** On the first launch only, reopen the board the user had open last (ui-routes.md). */
const reopenLastBoard = async () => {
  if (launched) return;
  launched = true;
  if (currentRoute.value.name !== "list") return;
  const { lastOpenedBoardId } = await getPreferences().catch(() => ({ lastOpenedBoardId: null }));
  if (!lastOpenedBoardId || currentRoute.value.name !== "list") return;
  const board = await openBoard(lastOpenedBoardId);
  if (board && currentRoute.value.name === "list")
    navigate({ name: "board", boardId: board.id }, { replace: true });
};

const notFound = () => {
  showToast("ボードが見つかりません");
  navigate({ name: "list" }, { replace: true });
};

const Screen = ({ route }: { route: Route }) => {
  const board = currentBoard.value;
  const id = boardIdOf(route);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || board?.id === id) return;
    setLoadingId(id);
    void openBoard(id).then((b) => {
      setLoadingId(null);
      if (!b) notFound();
    });
  }, [id, board?.id]);

  if (route.name === "list") return <BoardList />;
  if (route.name === "new") return <NewBoard />;
  if (!board || board.id !== id) return <p class="muted">{loadingId ? "読み込み中…" : ""}</p>;

  if (
    (route.name === "cell" || route.name === "crop") &&
    !isInside(board.size, route.row, route.col)
  ) {
    queueMicrotask(notFound);
    return null;
  }

  switch (route.name) {
    case "board":
      return <BoardView board={board} />;
    case "cell":
      return (
        <>
          <BoardView board={board} />
          <CellSheet
            key={`${route.row}-${route.col}`}
            board={board}
            row={route.row}
            col={route.col}
          />
        </>
      );
    case "crop":
      return <CropEditor board={board} row={route.row} col={route.col} />;
    case "export":
      return <ExportDialog board={board} />;
    case "settings":
      return <BoardSettings board={board} />;
  }
};

export const App = () => {
  useEffect(() => {
    void reopenLastBoard();
  }, []);
  const route = currentRoute.value;
  return (
    <>
      <main class="app">
        <AppBanners route={route} />
        <Screen route={route} />
      </main>
      <ConfirmDialogHost />
      <Toasts />
    </>
  );
};
