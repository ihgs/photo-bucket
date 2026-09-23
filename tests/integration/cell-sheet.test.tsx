import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
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
