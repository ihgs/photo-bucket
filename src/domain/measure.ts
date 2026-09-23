import { FONT_FAMILY, type Measure } from "./layout";

export const fontString = (fontPx: number, bold = false) =>
  `${bold ? 700 : 400} ${fontPx}px ${FONT_FAMILY}`;

/** Rough fallback used when no canvas is available (e.g. tests): full-width chars are 1em. */
export const estimateMeasure: Measure = (text, fontPx) =>
  [...text].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2e80 ? 0.55 : 1) * fontPx, 0);

let cached: Measure | null = null;

/** Measures text with the same font as the DOM and the exported canvas. */
export const createCanvasMeasure = (): Measure => {
  if (cached) return cached;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  try {
    ctx =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(1, 1).getContext("2d")
        : document.createElement("canvas").getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx || typeof ctx.measureText !== "function") return estimateMeasure;
  const c = ctx;
  const memo = new Map<string, number>();
  cached = (text, fontPx, bold = false) => {
    const key = `${bold ? 1 : 0}|${fontPx}|${text}`;
    let w = memo.get(key);
    if (w === undefined) {
      c.font = fontString(fontPx, bold);
      w = c.measureText(text).width;
      if (memo.size > 5000) memo.clear();
      memo.set(key, w);
    }
    return w;
  };
  return cached;
};

/** Waits until web/system fonts are ready so measurements are stable. */
export const ready = async () => {
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;
};
