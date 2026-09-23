import { describe, expect, it } from "vitest";
import { normalizeBoardTitle, validateBoard, validateCellInput } from "../../src/domain/validation";
import type { Board } from "../../src/domain/types";

const validBoard = (): Board => ({
  id: "b1",
  title: "ボード",
  size: { cols: 3, rows: 4 },
  cells: [{ id: "c1", row: 3, col: 2, title: "やる", category: "go", memo: "" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("board title", () => {
  it("trims and falls back to 無題のボード", () => {
    expect(normalizeBoardTitle("  旅行  ")).toBe("旅行");
    expect(normalizeBoardTitle("   ")).toBe("無題のボード");
  });
  it("limits to 40 characters", () => {
    expect(normalizeBoardTitle("あ".repeat(50))).toBe("あ".repeat(40));
  });
});

describe("cell input", () => {
  it("requires a 1-60 character title", () => {
    expect(validateCellInput({ title: "", category: "want" })).not.toBeNull();
    expect(validateCellInput({ title: "   ", category: "want" })).not.toBeNull();
    expect(validateCellInput({ title: "あ".repeat(60), category: "want" })).toBeNull();
    expect(validateCellInput({ title: "あ".repeat(61), category: "want" })).not.toBeNull();
  });
  it("limits memo to 500 characters", () => {
    expect(validateCellInput({ title: "a", category: "want", memo: "x".repeat(500) })).toBeNull();
    expect(
      validateCellInput({ title: "a", category: "want", memo: "x".repeat(501) }),
    ).not.toBeNull();
  });
  it("accepts only the four categories", () => {
    for (const c of ["want", "go", "eat", "other"]) {
      expect(validateCellInput({ title: "a", category: c })).toBeNull();
    }
    expect(validateCellInput({ title: "a", category: "drink" })).not.toBeNull();
  });
});

describe("board validation", () => {
  it("accepts a valid board", () => {
    expect(validateBoard(validBoard())).toEqual([]);
  });
  it("rejects cells outside the grid", () => {
    const b = validBoard();
    b.cells[0].row = 4;
    expect(validateBoard(b).length).toBeGreaterThan(0);
  });
  it("rejects duplicated positions", () => {
    const b = validBoard();
    b.cells.push({ ...b.cells[0], id: "c2" });
    expect(validateBoard(b).length).toBeGreaterThan(0);
  });
  it("rejects unsupported grid sizes", () => {
    const b = validBoard();
    b.size = { cols: 6, rows: 6 };
    expect(validateBoard(b).length).toBeGreaterThan(0);
  });
  it("requires crop and achievedAt when a photo exists", () => {
    const b = validBoard();
    b.cells[0].photoId = "p1";
    expect(validateBoard(b).length).toBeGreaterThan(0);
    b.cells[0].crop = { cx: 0.5, cy: 0.5, zoom: 1 };
    b.cells[0].achievedAt = "2026-01-02T00:00:00.000Z";
    expect(validateBoard(b)).toEqual([]);
  });
  it("rejects non-objects", () => {
    expect(validateBoard(null).length).toBeGreaterThan(0);
    expect(validateBoard({ id: 1 }).length).toBeGreaterThan(0);
  });
});
