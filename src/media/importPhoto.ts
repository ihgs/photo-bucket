import { UserFacingError } from "../app/errors";
import type { ImportedPhoto } from "../storage/photos";

export const MAX_EDGE = 1600;
export const THUMB_EDGE = 320;
const QUALITY = 0.85;

const fit = (w: number, h: number, max: number) => {
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
};

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

export const createCanvas = (width: number, height: number): AnyCanvas => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
};

export const canvasToJpeg = (canvas: AnyCanvas, quality: number): Promise<Blob> =>
  "convertToBlob" in canvas
    ? canvas.convertToBlob({ type: "image/jpeg", quality })
    : new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          quality,
        ),
      );

/** Draws the bitmap at the given size and encodes it as JPEG. Re-encoding drops all EXIF data. */
const encode = async (bitmap: ImageBitmap, width: number, height: number, quality: number) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("2D canvas is not available");
  ctx.fillStyle = "#ffffff"; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvasToJpeg(canvas, quality);
};

const unreadable = () => new UserFacingError("この写真は読み込めませんでした");

/**
 * Decodes a photo (honouring its orientation), shrinks it to at most 1600px on the long edge and
 * re-encodes it as JPEG with a 320px thumbnail (research R4).
 */
export const importPhoto = async (file: Blob): Promise<ImportedPhoto> => {
  if (file.type && !file.type.startsWith("image/")) throw unreadable();
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw unreadable();
  }
  try {
    const full = fit(bitmap.width, bitmap.height, MAX_EDGE);
    const thumb = fit(bitmap.width, bitmap.height, THUMB_EDGE);
    const [blob, thumbBlob] = await Promise.all([
      encode(bitmap, full.width, full.height, QUALITY),
      encode(bitmap, thumb.width, thumb.height, QUALITY),
    ]);
    return { blob, thumbBlob, width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
};
