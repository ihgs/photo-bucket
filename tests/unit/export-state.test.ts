import { describe, expect, it } from "vitest";
import { exportBackup } from "../../src/backup/exportBackup";
import { exportStateOf, sortForExport } from "../../src/backup/exportLog";
import { makeBoard } from "../helpers";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-09-26T00:00:00.000Z");
const iso = (t: number) => new Date(t).toISOString();

describe("exportStateOf", () => {
  const board = makeBoard({ id: "b", updatedAt: iso(now - 10 * DAY) });

  it("is never when the board has no record", () => {
    expect(exportStateOf(board, {}, now)).toBe("never");
  });
  it("is changed when the board was updated after its export", () => {
    expect(exportStateOf(board, { b: iso(now - 20 * DAY) }, now)).toBe("changed");
  });
  it("is stale when the export is 30 days old or more", () => {
    const old = makeBoard({ id: "b", updatedAt: iso(now - 40 * DAY) });
    expect(exportStateOf(old, { b: iso(now - 30 * DAY) }, now)).toBe("stale");
  });
  it("is fresh otherwise", () => {
    expect(exportStateOf(board, { b: iso(now - 5 * DAY) }, now)).toBe("fresh");
  });
});

describe("sortForExport (FR-020)", () => {
  const b = (id: string, updatedDaysAgo: number) =>
    makeBoard({ id, title: id, updatedAt: iso(now - updatedDaysAgo * DAY) });

  it("keeps the given order for 10 boards or fewer", () => {
    const boards = [b("a", 1), b("b", 2)];
    expect(sortForExport(boards, { a: iso(now) }, now)).toEqual(boards);
  });

  it("puts never-exported and changed boards first, then the oldest exports", () => {
    const boards = Array.from({ length: 12 }, (_, i) => b(`x${i}`, 50 + i));
    const log: Record<string, string> = {};
    for (const x of boards) log[x.id] = iso(now - 10 * DAY); // all fresh…
    log.x3 = iso(now - 40 * DAY); // …except: an old export
    log.x5 = iso(now - 20 * DAY); // an older one
    delete log.x7; // never exported
    boards[9] = b("x9", 1); // changed after its export
    const order = sortForExport(boards, log, now).map((x) => x.id);
    expect(order.slice(0, 4)).toEqual(["x7", "x9", "x3", "x5"]);
    expect(order).toHaveLength(12);
  });
});

describe("exportBackup limits (FR-015)", () => {
  it("refuses 0 or more than 10 boards", async () => {
    await expect(exportBackup([])).rejects.toThrow(RangeError);
    const eleven = Array.from({ length: 11 }, (_, i) => `id${i}`);
    await expect(exportBackup(eleven)).rejects.toThrow(RangeError);
  });
});
