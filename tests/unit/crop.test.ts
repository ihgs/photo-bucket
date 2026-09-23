import { describe, expect, it } from "vitest";
import {
  DEFAULT_CROP,
  clampCrop,
  imageBox,
  rotateCrop,
  rotationMatrix,
  sourceRect,
} from "../../src/domain/crop";

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

describe("rotation", () => {
  it("measures the crop on the rotated photo", () => {
    // 800×600 turned 90° is 600×800: the centred square is 600 at (0, 100)
    expect(sourceRect(800, 600, { ...DEFAULT_CROP, rotation: 90 })).toEqual({
      sx: 0,
      sy: 100,
      side: 600,
    });
    const c = clampCrop({ cx: 0, cy: 0, zoom: 1, rotation: 270 }, 800, 600);
    expect(c).toEqual({ cx: 0.5, cy: 300 / 800, zoom: 1, rotation: 270 });
  });
  it("drops an unknown rotation", () => {
    expect(clampCrop({ ...DEFAULT_CROP, rotation: 45 as never }, 100, 100)).toEqual(DEFAULT_CROP);
  });
  it("rotates clockwise, keeping the same point of the photo in the middle", () => {
    // the point at 30% from the left and 20% from the top of a square photo
    let c = rotateCrop({ cx: 0.3, cy: 0.2, zoom: 4 }, 1000, 1000);
    expect(c.rotation).toBe(90);
    expect(c.cx).toBeCloseTo(0.8, 9);
    expect(c.cy).toBeCloseTo(0.3, 9);
    c = rotateCrop(rotateCrop(rotateCrop(c, 1000, 1000), 1000, 1000), 1000, 1000);
    expect(c.rotation).toBeUndefined();
    expect(c.cx).toBeCloseTo(0.3, 9);
    expect(c.cy).toBeCloseTo(0.2, 9);
  });
  it("maps the photo onto its rotated size", () => {
    const apply = (m: number[], x: number, y: number) => [
      m[0] * x + m[2] * y + m[4],
      m[1] * x + m[3] * y + m[5],
    ];
    // the top-left corner of an 800×600 photo ends up at the top-right, bottom-right, bottom-left
    expect(apply(rotationMatrix(800, 600, 90), 0, 0)).toEqual([600, 0]);
    expect(apply(rotationMatrix(800, 600, 180), 0, 0)).toEqual([800, 600]);
    expect(apply(rotationMatrix(800, 600, 270), 0, 0)).toEqual([0, 800]);
    expect(apply(rotationMatrix(800, 600, 90), 800, 600)).toEqual([0, 800]);
  });
  it("centres the rotated <img> on the cell", () => {
    // 800×600 turned 90°, zoom 1, cell 300: the image is 400×300 before rotation and its centre
    // must sit at the centre of the rotated box (300×400 at (0, -50)), i.e. (150, 150)
    const box = imageBox(800, 600, { ...DEFAULT_CROP, rotation: 90 }, 300);
    expect(box.rotation).toBe(90);
    expect(box.width).toBeCloseTo(400, 9);
    expect(box.height).toBeCloseTo(300, 9);
    expect(box.left + box.width / 2).toBeCloseTo(150, 9);
    expect(box.top + box.height / 2).toBeCloseTo(150, 9);
  });
});
