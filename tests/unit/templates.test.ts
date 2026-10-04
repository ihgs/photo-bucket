import { describe, expect, it } from "vitest";
import { GRID_SIZES, isInside } from "../../src/domain/grid";
import { TEMPLATES, cellsFromTemplate, resolveTemplateTitle } from "../../src/domain/templates";
import { CATEGORIES } from "../../src/domain/types";
import { CELL_TITLE_MAX } from "../../src/domain/validation";

const byPosition = <T extends { row: number; col: number }>(items: readonly T[]) =>
  [...items].sort((a, b) => a.row - b.row || a.col - b.col);

describe("TEMPLATES (spec FR-002, FR-003)", () => {
  it("has the four templates with unique ids", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([
      "domestic-travel",
      "year-goals",
      "best-food",
      "seasons",
    ]);
  });

  for (const t of TEMPLATES) {
    describe(t.name, () => {
      it("fills every cell exactly once, inside the grid", () => {
        expect(GRID_SIZES).toContainEqual(t.size);
        expect(t.items).toHaveLength(t.size.cols * t.size.rows);
        for (const i of t.items) expect(isInside(t.size, i.row, i.col)).toBe(true);
        expect(new Set(t.items.map((i) => `${i.row},${i.col}`)).size).toBe(t.items.length);
      });

      it("uses short titles without counts or durations, and valid categories", () => {
        const categories = CATEGORIES.map((c) => c.id);
        for (const i of t.items) {
          expect(i.title.length).toBeGreaterThan(0);
          expect([...i.title].length).toBeLessThanOrEqual(CELL_TITLE_MAX);
          expect(i.title).not.toMatch(/[0-9０-９]/);
          expect(categories).toContain(i.category);
        }
      });
    });
  }

  it("lists Japan's 12 regions north to south, all as places to go", () => {
    const travel = TEMPLATES.find((t) => t.id === "domestic-travel")!;
    expect(travel.size).toEqual({ cols: 3, rows: 4 });
    expect(byPosition(travel.items).map((i) => i.title)).toEqual([
      "北海道旅行",
      "東北旅行",
      "関東旅行",
      "甲信越旅行",
      "北陸旅行",
      "東海旅行",
      "近畿旅行",
      "山陰旅行",
      "山陽旅行",
      "四国旅行",
      "九州旅行",
      "沖縄旅行",
    ]);
    expect(new Set(travel.items.map((i) => i.category))).toEqual(new Set(["go"]));
  });
});

describe("resolveTemplateTitle", () => {
  it("puts the year in", () => {
    expect(resolveTemplateTitle("{年}年の目標", new Date(2026, 9, 4))).toBe("2026年の目標");
  });
  it("leaves titles without a year alone", () => {
    expect(resolveTemplateTitle("国内旅行", new Date(2026, 9, 4))).toBe("国内旅行");
  });
});

describe("cellsFromTemplate", () => {
  it("makes plain cells with new ids, an empty memo and no photo", () => {
    const t = TEMPLATES[0];
    let n = 0;
    const cells = cellsFromTemplate(t, () => `id${n++}`);
    expect(cells).toHaveLength(t.items.length);
    expect(cells.map((c) => c.id)).toEqual(t.items.map((_, i) => `id${i}`));
    cells.forEach((c, i) => {
      expect(c).toEqual({
        id: `id${i}`,
        row: t.items[i].row,
        col: t.items[i].col,
        title: t.items[i].title,
        category: t.items[i].category,
        memo: "",
      });
    });
  });
});
