import { DEFAULT_CROP, rotationMatrix, rotationOf, sourceRect } from "../domain/crop";
import { CELL_BACKGROUND, layoutBoard, type TextBlock } from "../domain/layout";
import { createCanvasMeasure, fontString, ready } from "../domain/measure";
import type { Board, GridSize } from "../domain/types";
import { getPhoto } from "../storage/photos";
import { canvasToJpeg, createCanvas } from "./importPhoto";

export const EXPORT_LONG_EDGE = 2400;
const EXPORT_QUALITY = 0.92;

/** Output size: the long edge is 2400px and the aspect ratio equals the board's (contracts/export-image.md). */
export const exportSize = (size: GridSize) =>
  size.cols >= size.rows
    ? { width: EXPORT_LONG_EDGE, height: (EXPORT_LONG_EDGE * size.rows) / size.cols }
    : { width: (EXPORT_LONG_EDGE * size.cols) / size.rows, height: EXPORT_LONG_EDGE };

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "<title>-<YYYYMMDD>.jpg" with characters unusable in file names replaced by "_". */
export const exportFileName = (title: string, date = new Date()) =>
  `${title.replace(/[\\/:*?"<>|]/g, "_")}-${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}.jpg`;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawText = (ctx: Ctx, t: TextBlock, shadow = false) => {
  ctx.save();
  ctx.font = fontString(t.fontPx, t.bold);
  ctx.fillStyle = t.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = t.fontPx * 0.15;
    ctx.shadowOffsetY = t.fontPx * 0.05;
  }
  t.lines.forEach((line, i) => ctx.fillText(line, t.x, t.y + (i + 0.5) * t.lineHeight));
  ctx.restore();
};

const loadBitmap = async (photoId: string) => {
  const photo = await getPhoto(photoId);
  if (!photo) return null;
  const bitmap = await createImageBitmap(photo.blob);
  return { bitmap, width: photo.width, height: photo.height };
};

export interface RenderOptions {
  includeTitle: boolean;
  /** Output width; defaults to the export size. Height follows the board's aspect ratio. */
  width?: number;
}

/** Draws the board exactly as `layoutBoard` lays it out and encodes it as JPEG. */
export const renderBoard = async (board: Board, opts: RenderOptions): Promise<Blob> => {
  await ready();
  const size = exportSize(board.size);
  const width = opts.width ?? size.width;
  const layout = layoutBoard(board, {
    width,
    includeTitle: opts.includeTitle,
    measure: createCanvasMeasure(),
  });
  const canvas = createCanvas(Math.round(layout.width), Math.round(layout.height));
  const ctx = canvas.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("2D canvas is not available");
  ctx.imageSmoothingQuality = "high";

  // Decode all photos in parallel (SC-003).
  const bitmaps = new Map(
    await Promise.all(
      layout.cells
        .filter((c) => c.cell?.photoId)
        .map(async (c) => [c.cell!.photoId!, await loadBitmap(c.cell!.photoId!)] as const),
    ),
  );

  ctx.fillStyle = layout.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const c of layout.cells) {
    if (c.kind === "empty") continue;
    ctx.save();
    roundRect(ctx, c.x, c.y, c.size, c.size, c.radius);
    ctx.clip();
    ctx.fillStyle = CELL_BACKGROUND;
    ctx.fillRect(c.x, c.y, c.size, c.size);
    if (c.kind === "done") {
      const b = bitmaps.get(c.cell!.photoId!);
      if (b) {
        const crop = c.cell!.crop ?? DEFAULT_CROP;
        const r = sourceRect(b.width, b.height, crop);
        const k = c.size / r.side;
        ctx.save();
        ctx.translate(c.x - r.sx * k, c.y - r.sy * k);
        ctx.scale(k, k);
        ctx.transform(...rotationMatrix(b.width, b.height, rotationOf(crop)));
        ctx.drawImage(b.bitmap, 0, 0, b.width, b.height);
        ctx.restore();
      }
      if (c.caption) {
        ctx.fillStyle = c.caption.color;
        ctx.fillRect(c.x, c.caption.y, c.size, c.caption.height);
      }
    }
    if (c.band) {
      ctx.fillStyle = c.band.color;
      ctx.fillRect(c.x, c.y, c.size, c.band.height);
      drawText(ctx, c.band.labelText);
    }
    if (c.text) drawText(ctx, c.text);
    ctx.restore();
  }
  for (const b of bitmaps.values()) b?.bitmap.close();

  if (layout.titleBand) {
    const t = layout.titleBand;
    ctx.fillStyle = t.color;
    ctx.fillRect(t.x, t.y, t.width, t.height);
    drawText(ctx, t.textBlock, true);
  }

  return canvasToJpeg(canvas, EXPORT_QUALITY);
};
