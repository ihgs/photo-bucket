import { describe, expect, it } from "vitest";
import { GRID_SIZES, gridLabel } from "../../src/domain/grid";
import { exportSize } from "../../src/media/renderBoard";

describe("exportSize", () => {
  const expected: Record<string, [number, number]> = {
    "3×3": [2400, 2400],
    "4×4": [2400, 2400],
    "5×5": [2400, 2400],
    "3×4": [1800, 2400],
    "4×3": [2400, 1800],
  };
  for (const size of GRID_SIZES) {
    it(gridLabel(size), () => {
      const s = exportSize(size);
      expect([s.width, s.height]).toEqual(expected[gridLabel(size)]);
      expect(Math.max(s.width, s.height)).toBeGreaterThanOrEqual(2000);
      expect(s.width / s.height).toBeCloseTo(size.cols / size.rows, 12);
    });
  }
});
