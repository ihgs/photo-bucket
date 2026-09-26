import { describe, expect, it } from "vitest";
import {
  TITLE_BAND_ALPHA,
  compositeOver,
  contrastRatio,
  layoutBoard,
  wrapText,
} from "../../src/domain/layout";
import { GRID_SIZES } from "../../src/domain/grid";
import type { Cell } from "../../src/domain/types";
import { makeBoard, monoMeasure } from "../helpers";

const cell = (row: number, col: number, title: string, photo = false): Cell => ({
  id: `${row}-${col}`,
  row,
  col,
  title,
  category: "eat",
  ...(photo
    ? { photoId: `p${row}${col}`, crop: { cx: 0.5, cy: 0.5, zoom: 1 }, achievedAt: "2026-01-01" }
    : {}),
});

describe("layoutBoard geometry", () => {
  for (const size of GRID_SIZES) {
    // Square cells + exact aspect ratio are only both possible when the outer margin is half the
    // inner gap: cols·(2m − g) = rows·(2m − g) must hold for cols ≠ rows.
    it(`${size.cols}×${size.rows}: square cells, uniform gaps, exact aspect ratio`, () => {
      const board = makeBoard({ size });
      const l = layoutBoard(board, { width: 1200, includeTitle: false, measure: monoMeasure });
      expect(l.width).toBe(1200);
      expect(l.height).toBeCloseTo((1200 * size.rows) / size.cols, 6);
      expect(l.cells).toHaveLength(size.cols * size.rows);
      const sizes = new Set(l.cells.map((c) => c.size.toFixed(6)));
      expect(sizes.size).toBe(1);
      const [a, b] = [l.cells[0], l.cells[1]];
      const innerGap = b.x - (a.x + a.size);
      expect(innerGap).toBeCloseTo(l.gap, 6);
      // outer margin is half the inner gap, the same on all four sides
      const last = l.cells[l.cells.length - 1];
      expect(a.x).toBeCloseTo(l.gap / 2, 6);
      expect(a.x).toBeCloseTo(a.y, 6);
      expect(l.width - (last.x + last.size)).toBeCloseTo(a.x, 6);
      expect(l.height - (last.y + last.size)).toBeCloseTo(a.x, 6);
    });
  }

  for (const size of GRID_SIZES) {
    it(`${size.cols}×${size.rows}: only the board's four outer corners are rounded`, () => {
      const board = makeBoard({ size });
      const l = layoutBoard(board, { width: 1200, includeTitle: false, measure: monoMeasure });
      const last = { row: size.rows - 1, col: size.cols - 1 };
      for (const c of l.cells) {
        const [tl, tr, br, bl] = c.radii;
        expect(tl > 0).toBe(c.row === 0 && c.col === 0);
        expect(tr > 0).toBe(c.row === 0 && c.col === last.col);
        expect(br > 0).toBe(c.row === last.row && c.col === last.col);
        expect(bl > 0).toBe(c.row === last.row && c.col === 0);
      }
    });
  }

  it("scales proportionally and keeps the same line breaks at any width", () => {
    const board = makeBoard({
      size: { cols: 3, rows: 4 },
      cells: [
        cell(0, 0, "京都で抹茶パフェを食べる、そして清水寺に行く"),
        cell(1, 2, "富士山に登る", true),
      ],
    });
    const small = layoutBoard(board, { width: 360, includeTitle: false, measure: monoMeasure });
    const big = layoutBoard(board, { width: 2400, includeTitle: false, measure: monoMeasure });
    const k = 2400 / 360;
    small.cells.forEach((c, i) => {
      const d = big.cells[i];
      expect(d.x).toBeCloseTo(c.x * k, 6);
      expect(d.y).toBeCloseTo(c.y * k, 6);
      expect(d.size).toBeCloseTo(c.size * k, 6);
      expect(d.text?.lines).toEqual(c.text?.lines);
      expect(d.text?.fontPx ?? 0).toBeCloseTo((c.text?.fontPx ?? 0) * k, 6);
    });
  });

  it("truncates long titles with an ellipsis and never overflows the cell", () => {
    const long = "あ".repeat(60);
    const board = makeBoard({ size: { cols: 5, rows: 5 }, cells: [cell(0, 0, long)] });
    const l = layoutBoard(board, { width: 360, includeTitle: false, measure: monoMeasure });
    const c = l.cells[0];
    const t = c.text!;
    expect(t.lines.length).toBeLessThanOrEqual(t.maxLines);
    expect(t.lines[t.lines.length - 1].endsWith("…")).toBe(true);
    for (const line of t.lines)
      expect(monoMeasure(line, t.fontPx)).toBeLessThanOrEqual(t.maxWidth + 1e-9);
    expect(t.y + t.lines.length * t.lineHeight).toBeLessThanOrEqual(c.y + c.size + 1e-9);
  });

  it("classifies empty, todo and done cells", () => {
    const board = makeBoard({
      size: { cols: 3, rows: 3 },
      cells: [cell(0, 0, "a"), cell(0, 1, "b", true)],
    });
    const l = layoutBoard(board, { width: 300, includeTitle: false, measure: monoMeasure });
    expect(l.cells.map((c) => c.kind).slice(0, 3)).toEqual(["todo", "done", "empty"]);
    expect(l.cells[0].band).toBeDefined();
    expect(l.cells[1].caption).toBeDefined();
  });
});

describe("title overlay", () => {
  it("overlays the title band without changing the size", () => {
    const board = makeBoard({ size: { cols: 3, rows: 4 }, title: "2026年やりたいこと" });
    const without = layoutBoard(board, { width: 1800, includeTitle: false, measure: monoMeasure });
    const withTitle = layoutBoard(board, { width: 1800, includeTitle: true, measure: monoMeasure });
    expect(withTitle.width).toBe(without.width);
    expect(withTitle.height).toBe(without.height);
    expect(withTitle.cells).toEqual(without.cells);
    const band = withTitle.titleBand!;
    expect(band.y).toBe(0);
    expect(band.x).toBe(0);
    expect(band.width).toBe(1800);
    expect(band.text).toBe("2026年やりたいこと");
    expect(without.titleBand).toBeUndefined();
  });

  it("keeps white text readable on white and black backgrounds (>= 4.5:1)", () => {
    const white: [number, number, number] = [255, 255, 255];
    const black: [number, number, number] = [0, 0, 0];
    const onWhite = compositeOver(black, TITLE_BAND_ALPHA, white);
    const onBlack = compositeOver(black, TITLE_BAND_ALPHA, black);
    expect(contrastRatio(white, onWhite)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(white, onBlack)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("wrapText", () => {
  it("wraps greedily by character", () => {
    expect(wrapText("あいうえおか", 3, 1, 5, monoMeasure)).toEqual(["あいう", "えおか"]);
  });
  it("adds an ellipsis when exceeding max lines", () => {
    expect(wrapText("あいうえおかき", 3, 1, 2, monoMeasure)).toEqual(["あいう", "えお…"]);
  });
  it("does not start a line with closing punctuation", () => {
    expect(wrapText("あいう、えお", 3, 1, 5, monoMeasure)).toEqual(["あい", "う、え", "お"]);
  });
  it("honours explicit newlines and trims leading spaces", () => {
    expect(wrapText("ab\ncd", 10, 1, 5, monoMeasure)).toEqual(["ab", "cd"]);
  });
});
