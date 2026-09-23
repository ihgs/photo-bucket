import { describe, expect, it } from "vitest";
import { shouldRemind } from "../../src/ui/components/BackupReminder";

describe("shouldRemind", () => {
  const now = Date.parse("2026-09-23T00:00:00.000Z");
  it("does not remind without photos", () => {
    expect(shouldRemind(0, null, now)).toBe(false);
  });
  it("reminds when never backed up", () => {
    expect(shouldRemind(1, null, now)).toBe(true);
  });
  it("reminds after 30 days", () => {
    expect(shouldRemind(3, "2026-08-24T00:00:00.000Z", now)).toBe(true);
    expect(shouldRemind(3, "2026-08-25T00:00:00.000Z", now)).toBe(false);
  });
});
