import type { Crop, Rotation } from "./types";

export const DEFAULT_CROP: Crop = { cx: 0.5, cy: 0.5, zoom: 1 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const finite = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);

export const rotationOf = (crop: Crop): Rotation =>
  ROTATIONS.includes(crop.rotation as Rotation) ? (crop.rotation as Rotation) : 0;

/** Size of the photo as shown, i.e. after rotating it. */
export const rotatedSize = (width: number, height: number, rotation: Rotation) =>
  rotation % 180 === 0 ? { width, height } : { width: height, height: width };

/** Keeps zoom in 1..4 and the visible square inside the (rotated) photo. */
export const clampCrop = (crop: Crop, width: number, height: number): Crop => {
  const rotation = rotationOf(crop);
  const r = rotatedSize(width, height, rotation);
  const zoom = clamp(finite(crop.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  const side = Math.min(r.width, r.height) / zoom;
  const hx = side / 2 / r.width;
  const hy = side / 2 / r.height;
  const out: Crop = {
    cx: clamp(finite(crop.cx, 0.5), hx, 1 - hx),
    cy: clamp(finite(crop.cy, 0.5), hy, 1 - hy),
    zoom,
  };
  if (rotation) out.rotation = rotation;
  return out;
};

/** Rotates the photo 90° clockwise, keeping the same point of it in the middle of the cell. */
export const rotateCrop = (crop: Crop, width: number, height: number): Crop =>
  clampCrop(
    {
      cx: 1 - crop.cy,
      cy: crop.cx,
      zoom: crop.zoom,
      rotation: ((rotationOf(crop) + 90) % 360) as Rotation,
    },
    width,
    height,
  );

/** The square of the rotated photo (in its pixels) that fills the cell. */
export const sourceRect = (width: number, height: number, crop: Crop) => {
  const c = clampCrop(crop, width, height);
  const r = rotatedSize(width, height, rotationOf(c));
  const side = Math.min(r.width, r.height) / c.zoom;
  return { sx: c.cx * r.width - side / 2, sy: c.cy * r.height - side / 2, side };
};

/**
 * CSS box for an unrotated <img> of the photo that, turned by `rotation` degrees around its centre,
 * makes `sourceRect` exactly fill a cell of `cellSize` px.
 */
export const imageBox = (width: number, height: number, crop: Crop, cellSize: number) => {
  const rotation = rotationOf(crop);
  const src = sourceRect(width, height, crop);
  const r = rotatedSize(width, height, rotation);
  const k = cellSize / src.side;
  const w = width * k;
  const h = height * k;
  return {
    left: -src.sx * k + (r.width * k - w) / 2,
    top: -src.sy * k + (r.height * k - h) / 2,
    width: w,
    height: h,
    rotation,
  };
};

/**
 * Canvas transform (a, b, c, d, e, f) that draws the photo at (0, 0, width, height) rotated so it
 * covers (0, 0) to its rotated size.
 */
export const rotationMatrix = (
  width: number,
  height: number,
  rotation: Rotation,
): [number, number, number, number, number, number] => {
  switch (rotation) {
    case 90:
      return [0, 1, -1, 0, height, 0];
    case 180:
      return [-1, 0, 0, -1, width, height];
    case 270:
      return [0, -1, 1, 0, 0, width];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
};
