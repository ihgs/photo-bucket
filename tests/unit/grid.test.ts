import { describe, expect, it } from "vitest";
import {
  GRID_SIZES,
  aspectRatio,
  countAchieved,
  findCell,
  gridLabel,
  isValidGridSize,
  totalCells,
} from "../../src/domain/grid";
import type { Board } from "../../src/domain/types";

const board = (cells: Board["cells"], cols = 3, rows = 4): Board => ({
  id: "b1",
  title: "t",
  size: { cols, rows },
  cells,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("grid sizes", () => {
  it("allows exactly the five sizes", () => {
    expect(GRID_SIZES.map((s) => gridLabel(s))).toEqual(["3×3", "4×4", "5×5", "3×4", "4×3"]);
    expect(isValidGridSize({ cols: 3, rows: 4 })).toBe(true);
    expect(isValidGridSize({ cols: 4, rows: 3 })).toBe(true);
    expect(isValidGridSize({ cols: 6, rows: 6 })).toBe(false);
    expect(isValidGridSize({ cols: 2, rows: 3 })).toBe(false);
  });

  it("labels as columns × rows", () => {
    expect(gridLabel({ cols: 3, rows: 4 })).toBe("3×4");
  });

  it("computes the board aspect ratio", () => {
    expect(aspectRatio({ cols: 5, rows: 5 })).toBe(1);
    expect(aspectRatio({ cols: 3, rows: 4 })).toBe(3 / 4);
    expect(aspectRatio({ cols: 4, rows: 3 })).toBe(4 / 3);
  });
});

describe("achievement count", () => {
  it("counts cells with photos and total cells", () => {
    const b = board([
      { id: "c1", row: 0, col: 0, title: "a", category: "want" },
      {
        id: "c2",
        row: 1,
        col: 1,
        title: "b",
        category: "eat",
        photoId: "p1",
        crop: { cx: 0.5, cy: 0.5, zoom: 1 },
        achievedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    expect(countAchieved(b)).toBe(1);
    expect(totalCells(b.size)).toBe(12);
    expect(findCell(b, 1, 1)?.id).toBe("c2");
    expect(findCell(b, 2, 2)).toBeUndefined();
  });
});
