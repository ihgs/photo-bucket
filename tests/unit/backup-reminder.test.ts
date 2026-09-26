import { describe, expect, it } from "vitest";
import { needsReminder } from "../../src/backup/exportLog";
import { makeBoard } from "../helpers";

describe("needsReminder (FR-019)", () => {
  const now = Date.parse("2026-09-23T00:00:00.000Z");
  const board = makeBoard({ id: "b", updatedAt: "2026-08-01T00:00:00.000Z" });
  const photos = new Set(["b"]);

  it("does not remind without photos", () => {
    expect(needsReminder([board], new Set(), {}, now)).toBe(false);
  });
  it("reminds when never backed up", () => {
    expect(needsReminder([board], photos, {}, now)).toBe(true);
  });
  it("reminds after 30 days", () => {
    expect(needsReminder([board], photos, { b: "2026-08-24T00:00:00.000Z" }, now)).toBe(true);
    expect(needsReminder([board], photos, { b: "2026-08-25T00:00:00.000Z" }, now)).toBe(false);
  });
  it("reminds when the board changed after its backup", () => {
    const changed = { ...board, updatedAt: "2026-09-01T00:00:00.000Z" };
    expect(needsReminder([changed], photos, { b: "2026-08-25T00:00:00.000Z" }, now)).toBe(true);
  });
});
