import type { Crop } from "./types";

export const DEFAULT_CROP: Crop = { cx: 0.5, cy: 0.5, zoom: 1 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const finite = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);

/** Keeps zoom in 1..4 and the visible square inside the photo. */
export const clampCrop = (crop: Crop, width: number, height: number): Crop => {
  const zoom = clamp(finite(crop.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  const side = Math.min(width, height) / zoom;
  const hx = side / 2 / width;
  const hy = side / 2 / height;
  return {
    cx: clamp(finite(crop.cx, 0.5), hx, 1 - hx),
    cy: clamp(finite(crop.cy, 0.5), hy, 1 - hy),
    zoom,
  };
};

/** The square of the original photo (in its pixels) that fills the cell. */
export const sourceRect = (width: number, height: number, crop: Crop) => {
  const c = clampCrop(crop, width, height);
  const side = Math.min(width, height) / c.zoom;
  return { sx: c.cx * width - side / 2, sy: c.cy * height - side / 2, side };
};

/** CSS box for an <img> of the photo so that `sourceRect` exactly fills a cell of `cellSize` px. */
export const imageBox = (width: number, height: number, crop: Crop, cellSize: number) => {
  const r = sourceRect(width, height, crop);
  const k = cellSize / r.side;
  return { left: -r.sx * k, top: -r.sy * k, width: width * k, height: height * k };
};
