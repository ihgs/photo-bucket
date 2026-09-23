import { describe, expect, it } from "vitest";
import {
  cellsOutside,
  removeCell,
  resizeBoard,
  swapCells,
  upsertCell,
} from "../../src/domain/grid";
import type { Cell } from "../../src/domain/types";
import { makeBoard } from "../helpers";

const done: Cell = {
  id: "c-done",
  row: 0,
  col: 0,
  title: "富士山",
  category: "go",
  photoId: "p1",
  crop: { cx: 0.3, cy: 0.6, zoom: 2 },
  achievedAt: "2026-05-01T00:00:00.000Z",
};
const todo: Cell = { id: "c-todo", row: 1, col: 2, title: "パフェ", category: "eat" };

describe("upsertCell", () => {
  it("adds a cell to an empty position", () => {
    const b = makeBoard();
    const next = upsertCell(b, 2, 1, { title: " 温泉 ", category: "go", memo: "" });
    expect(b.cells).toEqual([]);
    expect(next.cells).toHaveLength(1);
    expect(next.cells[0]).toMatchObject({ row: 2, col: 1, title: "温泉", category: "go" });
    expect(next.cells[0].id).toBeTruthy();
  });
  it("updates an existing cell and keeps its id and photo", () => {
    const b = makeBoard({ cells: [done] });
    const next = upsertCell(b, 0, 0, { title: "富士山頂", category: "want", memo: "朝日" });
    expect(next.cells[0]).toEqual({ ...done, title: "富士山頂", category: "want", memo: "朝日" });
  });
});

describe("removeCell", () => {
  it("removes the cell and reports its photo", () => {
    const b = makeBoard({ cells: [done, todo] });
    const r = removeCell(b, 0, 0);
    expect(r.board.cells).toEqual([todo]);
    expect(r.removedPhotoIds).toEqual(["p1"]);
    expect(removeCell(b, 1, 2).removedPhotoIds).toEqual([]);
  });
});

describe("swapCells", () => {
  it("swaps two filled cells, keeping photo, crop and achievedAt", () => {
    const b = makeBoard({ cells: [done, todo] });
    const next = swapCells(b, { row: 0, col: 0 }, { row: 1, col: 2 });
    const moved = next.cells.find((c) => c.id === "c-done")!;
    expect(moved).toEqual({ ...done, row: 1, col: 2 });
    expect(next.cells.find((c) => c.id === "c-todo")).toEqual({ ...todo, row: 0, col: 0 });
  });
  it("moves a cell into an empty position", () => {
    const b = makeBoard({ cells: [todo] });
    const next = swapCells(b, { row: 1, col: 2 }, { row: 3, col: 0 });
    expect(next.cells).toEqual([{ ...todo, row: 3, col: 0 }]);
  });
  it("is a no-op for two empty positions", () => {
    const b = makeBoard({ cells: [todo] });
    expect(swapCells(b, { row: 0, col: 0 }, { row: 0, col: 1 }).cells).toEqual([todo]);
  });
});

describe("resize", () => {
  const b = makeBoard({
    size: { cols: 3, rows: 4 },
    cells: [done, todo, { id: "c-row3", row: 3, col: 0, title: "x", category: "other" }],
  });
  it("lists cells outside the new size", () => {
    expect(cellsOutside(b, { cols: 4, rows: 3 }).map((c) => c.id)).toEqual(["c-row3"]);
    expect(cellsOutside(b, { cols: 5, rows: 5 })).toEqual([]);
    expect(cellsOutside(b, { cols: 3, rows: 3 }).map((c) => c.id)).toEqual(["c-row3"]);
  });
  it("drops outside cells and keeps positions of the others", () => {
    const r = resizeBoard(
      makeBoard({
        size: { cols: 5, rows: 5 },
        cells: [
          done,
          {
            ...todo,
            row: 4,
            col: 4,
            photoId: "p9",
            crop: { cx: 0.5, cy: 0.5, zoom: 1 },
            achievedAt: "x",
          },
        ],
      }),
      { cols: 3, rows: 3 },
    );
    expect(r.board.size).toEqual({ cols: 3, rows: 3 });
    expect(r.board.cells).toEqual([done]);
    expect(r.removedPhotoIds).toEqual(["p9"]);
  });
  it("rejects unsupported sizes", () => {
    expect(() => resizeBoard(b, { cols: 6, rows: 6 })).toThrow();
  });
});
