import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { upsertCell } from "../../src/domain/grid";
import { createBoard, getBoard, saveBoard } from "../../src/storage/boards";
import { resetDbForTests } from "../../src/storage/db";
import { CellSheet } from "../../src/ui/screens/CellSheet";
import { currentBoard } from "../../src/ui/state/boardStore";

beforeEach(async () => {
  await resetDbForTests();
});
afterEach(() => cleanup());

describe("CellSheet photo import", () => {
  it("shows an error and keeps the cell unchanged for a non-image file", async () => {
    let board = await createBoard("A", { cols: 3, rows: 3 });
    board = await saveBoard(upsertCell(board, 0, 0, { title: "海", category: "go" }));
    currentBoard.value = board;

    render(<CellSheet board={board} row={0} col={0} />);
    const input = screen.getByLabelText("ライブラリから選ぶ") as HTMLInputElement;
    const file = new File(["hello"], "note.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText("この写真は読み込めませんでした")).toBeTruthy();
    const stored = await getBoard(board.id);
    expect(stored?.cells[0].photoId).toBeUndefined();
    expect(currentBoard.value?.cells[0].photoId).toBeUndefined();
  });

  it("shows an error for an image that cannot be decoded", async () => {
    let board = await createBoard("A", { cols: 3, rows: 3 });
    board = await saveBoard(upsertCell(board, 0, 0, { title: "海", category: "go" }));
    currentBoard.value = board;

    render(<CellSheet board={board} row={0} col={0} />);
    const input = screen.getByLabelText("ライブラリから選ぶ") as HTMLInputElement;
    const file = new File(["broken"], "broken.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText("この写真は読み込めませんでした")).toBeTruthy();
    expect((await getBoard(board.id))?.cells[0].photoId).toBeUndefined();
  });
});

describe("CellSheet view mode (#9)", () => {
  const seed = async () => {
    let board = await createBoard("A", { cols: 3, rows: 3 });
    board = await saveBoard(
      upsertCell(board, 0, 0, { title: "箱根で日帰り温泉", category: "go", memo: "朝早く" }),
    );
    currentBoard.value = board;
    return board;
  };

  it("keeps the form for a new item", async () => {
    const board = await createBoard("A", { cols: 3, rows: 3 });
    currentBoard.value = board;
    render(<CellSheet board={board} row={1} col={1} />);
    expect(screen.getByLabelText("やりたいこと")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "やりたいこととカテゴリを編集" })).toBeNull();
  });

  it("shows the item read-only with the photo above the memo", async () => {
    const board = await seed();
    const { container } = render(<CellSheet board={board} row={0} col={0} />);
    expect(screen.getByText("箱根で日帰り温泉")).toBeTruthy();
    expect(screen.getByText("行きたい")).toBeTruthy();
    expect(screen.queryByLabelText("やりたいこと")).toBeNull();
    expect(screen.queryByRole("button", { name: "項目を削除" })).toBeNull();
    const photo = screen.getByText("達成の写真");
    const memo = screen.getByLabelText("メモ（任意）") as HTMLTextAreaElement;
    expect(memo.value).toBe("朝早く");
    expect(photo.compareDocumentPosition(memo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector("input[name=title]")).toBeNull();
  });

  it("saves the memo from the read-only view", async () => {
    const board = await seed();
    render(<CellSheet board={board} row={0} col={0} />);
    const memo = screen.getByLabelText("メモ（任意）");
    fireEvent.input(memo, { target: { value: "タオルを持っていく" } });
    await waitFor(async () =>
      expect((await getBoard(board.id))?.cells[0].memo).toBe("タオルを持っていく"),
    );
  });

  it("edits the title and category with the pencil button", async () => {
    const board = await seed();
    render(<CellSheet board={board} row={0} col={0} />);
    fireEvent.click(screen.getByRole("button", { name: "やりたいこととカテゴリを編集" }));
    const title = screen.getByLabelText("やりたいこと") as HTMLInputElement;
    expect(title.value).toBe("箱根で日帰り温泉");
    expect(screen.getByRole("button", { name: "項目を削除" })).toBeTruthy();

    fireEvent.input(title, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "完了" }));
    expect(screen.getByRole("alert")).toBeTruthy(); // an empty title keeps the form open

    fireEvent.input(title, { target: { value: "草津温泉" } });
    fireEvent.click(screen.getByRole("radio", { name: "その他" }));
    fireEvent.click(screen.getByRole("button", { name: "完了" }));
    expect(screen.queryByLabelText("やりたいこと")).toBeNull();
    await waitFor(async () => {
      const cell = (await getBoard(board.id))?.cells[0];
      expect(cell?.title).toBe("草津温泉");
      expect(cell?.category).toBe("other");
    });
  });
});

describe("CellSheet on a small visual viewport (#3)", () => {
  const listeners: Record<string, () => void> = {};
  const vv = {
    offsetTop: 0,
    height: 800,
    addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
    removeEventListener: (type: string) => delete listeners[type],
  };
  let original: VisualViewport | null;
  beforeEach(() => {
    original = window.visualViewport;
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(window, "visualViewport", { value: original, configurable: true });
  });

  it("keeps the sheet inside the visible area and locks the page while open", async () => {
    const board = await createBoard("A", { cols: 3, rows: 3 });
    currentBoard.value = board;
    const { container, unmount } = render(<CellSheet board={board} row={0} col={0} />);
    const backdrop = container.querySelector(".modal-backdrop") as HTMLElement;
    expect(backdrop.style.height).toBe("800px");
    expect(document.documentElement.classList.contains("modal-open")).toBe(true);

    // the keyboard opens: the visible area shrinks and is scrolled down
    vv.height = 420;
    vv.offsetTop = 120;
    listeners.resize();
    expect(backdrop.style.top).toBe("120px");
    expect(backdrop.style.height).toBe("420px");

    unmount();
    expect(document.documentElement.classList.contains("modal-open")).toBe(false);
    expect(listeners.resize).toBeUndefined();
  });
});
