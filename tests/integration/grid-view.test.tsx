import { describe, expect, it } from "vitest";
import { render } from "@testing-library/preact";
import { GridView } from "../../src/ui/components/GridView";
import { makeBoard } from "../helpers";

describe("GridView", () => {
  it("truncates a 60-character title inside a 5×5 cell at 360px", () => {
    const board = makeBoard({
      size: { cols: 5, rows: 5 },
      cells: [{ id: "c", row: 0, col: 0, title: "あ".repeat(60), category: "want" }],
    });
    const { container } = render(<GridView board={board} width={360} onCellClick={() => {}} />);
    const tile = container.querySelector<HTMLElement>('.grid-cell[data-row="0"][data-col="0"]')!;
    const size = parseFloat(tile.style.width);
    const lines = [...tile.querySelectorAll<HTMLElement>(".line")].slice(1); // first line is the category label
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[lines.length - 1].textContent!.endsWith("…")).toBe(true);
    for (const line of lines) {
      const bottom = parseFloat(line.style.top) + parseFloat(line.style.height);
      expect(bottom).toBeLessThanOrEqual(size + 1e-6);
      expect(parseFloat(line.style.left) + parseFloat(line.style.width)).toBeLessThanOrEqual(
        size + 1e-6,
      );
    }
    expect(tile.getAttribute("aria-label")).toBe(`1行1列 ${"あ".repeat(60)} 未達成`);
  });

  it("renders every cell of a 4×3 board with the exact aspect ratio", () => {
    const board = makeBoard({ size: { cols: 4, rows: 3 } });
    const { container } = render(<GridView board={board} width={400} onCellClick={() => {}} />);
    const grid = container.querySelector<HTMLElement>(".grid")!;
    expect(parseFloat(grid.style.width) / parseFloat(grid.style.height)).toBeCloseTo(4 / 3, 9);
    expect(container.querySelectorAll(".grid-cell")).toHaveLength(12);
  });
});
