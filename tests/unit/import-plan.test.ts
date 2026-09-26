import { describe, expect, it } from "vitest";
import type { ImportSource } from "../../src/backup/importBackup";
import { planImport } from "../../src/backup/importPlan";
import type { Board } from "../../src/domain/types";
import { makeBoard } from "../helpers";

const source = (name: string, boards: Board[]): ImportSource => ({
  name,
  zip: { names: () => [], read: async () => undefined },
  boards,
  photos: new Map(),
});

const board = (id: string, updatedAt = "2026-01-01T00:00:00.000Z") =>
  makeBoard({ id, title: id, updatedAt });

describe("planImport (add)", () => {
  it("adds new boards and counts the ones that already exist", () => {
    const plan = planImport([source("a.pbz", [board("x"), board("y")])], ["y", "z"], "add", "skip");
    expect(plan.conflicts).toBe(1);
    expect(plan.items.map((i) => [i.board.id, i.action])).toEqual([
      ["x", "add"],
      ["y", "skip"],
    ]);
    expect(plan.deleteIds).toEqual([]);
  });
});

describe("planImport (replace and conflict choices)", () => {
  it("replace overwrites existing boards and deletes the ones not in the backup", () => {
    const plan = planImport(
      [source("a.pbz", [board("x"), board("y")])],
      ["y", "z", "w"],
      "replace",
    );
    expect(plan.items.map((i) => [i.board.id, i.action])).toEqual([
      ["x", "add"],
      ["y", "overwrite"],
    ]);
    expect(plan.deleteIds).toEqual(["z", "w"]);
  });

  it.each([
    ["overwrite", "overwrite"],
    ["copy", "copy"],
    ["skip", "skip"],
  ] as const)("add applies %s to every existing board", (choice, action) => {
    const plan = planImport([source("a.pbz", [board("x"), board("y")])], ["x", "y"], "add", choice);
    expect(plan.conflicts).toBe(2);
    expect(plan.items.map((i) => i.action)).toEqual([action, action]);
  });
});

describe("planImport (several files, FR-009)", () => {
  it("counts a board found in two files once, using the newest one", () => {
    const older = source("1.pbz", [board("x", "2026-01-01T00:00:00.000Z"), board("y")]);
    const newer = source("2.pbz", [board("x", "2026-02-01T00:00:00.000Z"), board("z")]);
    for (const order of [
      [older, newer],
      [newer, older],
    ]) {
      const plan = planImport(order, [], "add");
      expect(plan.items).toHaveLength(3);
      const x = plan.items.find((i) => i.board.id === "x")!;
      expect(x.source.name).toBe("2.pbz");
    }
  });

  it("uses the later file on a tie", () => {
    const a = source("a.pbz", [board("x")]);
    const b = source("b.pbz", [board("x")]);
    expect(planImport([a, b], [], "add").items[0].source.name).toBe("b.pbz");
  });

  it("has nothing to read when the files hold no boards", () => {
    expect(planImport([source("empty.pbz", [])], ["a"], "replace").items).toEqual([]);
  });
});
