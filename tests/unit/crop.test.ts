import { describe, expect, it } from "vitest";
import { DEFAULT_CROP, clampCrop, sourceRect } from "../../src/domain/crop";

describe("clampCrop", () => {
  it("defaults to the centre at zoom 1", () => {
    expect(DEFAULT_CROP).toEqual({ cx: 0.5, cy: 0.5, zoom: 1 });
  });
  it("limits zoom to 1..4", () => {
    expect(clampCrop({ cx: 0.5, cy: 0.5, zoom: 0.2 }, 800, 600).zoom).toBe(1);
    expect(clampCrop({ cx: 0.5, cy: 0.5, zoom: 9 }, 800, 600).zoom).toBe(4);
  });
  it("keeps the visible square inside the photo", () => {
    // landscape 800×600 at zoom 1: side 600, so cx ∈ [300/800, 500/800], cy fixed at 0.5
    const c = clampCrop({ cx: 0, cy: 0, zoom: 1 }, 800, 600);
    expect(c.cx).toBeCloseTo(300 / 800, 9);
    expect(c.cy).toBeCloseTo(0.5, 9);
    const d = clampCrop({ cx: 1, cy: 1, zoom: 2 }, 800, 600);
    // side 300
    expect(d.cx).toBeCloseTo(1 - 150 / 800, 9);
    expect(d.cy).toBeCloseTo(1 - 150 / 600, 9);
  });
  it("replaces non-finite values with defaults", () => {
    expect(clampCrop({ cx: NaN, cy: Infinity, zoom: NaN }, 100, 100)).toEqual(DEFAULT_CROP);
  });
});

describe("sourceRect", () => {
  it("returns the centred square of the short side at zoom 1", () => {
    expect(sourceRect(600, 900, DEFAULT_CROP)).toEqual({ sx: 0, sy: 150, side: 600 });
    expect(sourceRect(900, 600, DEFAULT_CROP)).toEqual({ sx: 150, sy: 0, side: 600 });
    expect(sourceRect(500, 500, DEFAULT_CROP)).toEqual({ sx: 0, sy: 0, side: 500 });
  });
  it("zooms around the centre point", () => {
    const r = sourceRect(1000, 1000, { cx: 0.25, cy: 0.75, zoom: 2 });
    expect(r).toEqual({ sx: 0, sy: 500, side: 500 });
  });
  it("never leaves the photo even with an unclamped crop", () => {
    const r = sourceRect(800, 600, { cx: 0, cy: 0, zoom: 1 });
    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sy).toBeGreaterThanOrEqual(0);
    expect(r.sx + r.side).toBeLessThanOrEqual(800);
  });
});
