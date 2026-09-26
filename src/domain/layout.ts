/**
 * Board layout shared by the on-screen grid (DOM) and the exported image (Canvas).
 * Both renderers draw only from the values returned here, so they always match (research R6).
 *
 * All sizes are computed on a reference width of 1000 units and then scaled, so text is wrapped
 * identically at any output width.
 */
import { CATEGORIES, type Board, type Category, type Cell } from "./types";

export const FONT_FAMILY =
  'system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif';

export type Measure = (text: string, fontPx: number, bold?: boolean) => number;

export const BOARD_BACKGROUND = "#f4efe6";
export const CELL_BACKGROUND = "#ffffff";
export const TEXT_COLOR = "#1f2328";
export const TITLE_BAND_ALPHA = 0.55;
export const TITLE_BAND_COLOR = `rgba(0, 0, 0, ${TITLE_BAND_ALPHA})`;
export const CAPTION_BAND_COLOR = "rgba(0, 0, 0, 0.55)";

const REF_WIDTH = 1000;
const GAP_RATIO = 0.006; // inner gap relative to width
const LINE_HEIGHT = 1.25;

export interface TextBlock {
  lines: string[];
  fontPx: number;
  lineHeight: number;
  bold: boolean;
  /** Left edge of the text box. */
  x: number;
  /** Top of the first line box. */
  y: number;
  maxWidth: number;
  maxLines: number;
  color: string;
}

export interface CategoryBand {
  category: Category;
  label: string;
  color: string;
  /** Colored strip at the top of the cell. */
  height: number;
  /** Category name drawn below the strip. */
  labelText: TextBlock;
}

export interface CaptionBand {
  y: number;
  height: number;
  color: string;
}

export type CornerRadii = [number, number, number, number];

export interface CellLayout {
  row: number;
  col: number;
  x: number;
  y: number;
  size: number;
  /** Corner radii in CSS order (top-left, top-right, bottom-right, bottom-left). Only the board's
   * four outer corners are rounded. */
  radii: CornerRadii;
  kind: "empty" | "todo" | "done";
  cell?: Cell;
  band?: CategoryBand;
  caption?: CaptionBand;
  text?: TextBlock;
}

export interface TitleBand {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
  textBlock: TextBlock;
}

export interface BoardLayout {
  width: number;
  height: number;
  gap: number;
  background: string;
  cells: CellLayout[];
  titleBand?: TitleBand;
}

export interface LayoutOptions {
  width: number;
  includeTitle: boolean;
  measure: Measure;
}

const NO_LINE_START = "、。，．,.）)」』】〉》！？!?ー～ぁぃぅぇぉっゃゅょァィゥェォッャュョ…";

/** Greedy per-character wrapping (works for Japanese without spaces). Adds "…" when truncated. */
export const wrapText = (
  text: string,
  maxWidth: number,
  fontPx: number,
  maxLines: number,
  measure: Measure,
  bold = false,
): string[] => {
  const fits = (s: string) => measure(s, fontPx, bold) <= maxWidth;
  const lines: string[] = [];
  let truncated = false;
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n");
  outer: for (let p = 0; p < paragraphs.length; p++) {
    let current = "";
    for (const ch of paragraphs[p]) {
      if (!current && ch === " ") continue;
      if (fits(current + ch)) {
        current += ch;
        continue;
      }
      // Kinsoku: never start a line with closing punctuation; carry the previous char along.
      let carry = "";
      if (NO_LINE_START.includes(ch) && [...current].length > 1) {
        const chars = [...current];
        carry = chars.pop()!;
        current = chars.join("");
      }
      lines.push(current);
      if (lines.length === maxLines) {
        truncated = true;
        break outer;
      }
      current = ch === " " ? carry : carry + ch;
    }
    lines.push(current);
    if (lines.length === maxLines && p < paragraphs.length - 1) {
      truncated = true;
      break;
    }
  }
  if (lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }
  if (truncated) {
    let last = lines[lines.length - 1].trimEnd();
    while (last && !fits(last + "…")) last = [...last].slice(0, -1).join("");
    lines[lines.length - 1] = last + "…";
  }
  return lines;
};

const textBlock = (
  text: string,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    fontPx: number;
    maxLines: number;
    bold: boolean;
    color: string;
  },
  measure: Measure,
): TextBlock => ({
  lines: wrapText(text, opts.maxWidth, opts.fontPx, opts.maxLines, measure, opts.bold),
  fontPx: opts.fontPx,
  lineHeight: opts.fontPx * LINE_HEIGHT,
  bold: opts.bold,
  x: opts.x,
  y: opts.y,
  maxWidth: opts.maxWidth,
  maxLines: opts.maxLines,
  color: opts.color,
});

const scaleText = (t: TextBlock, k: number): TextBlock => ({
  ...t,
  fontPx: t.fontPx * k,
  lineHeight: t.lineHeight * k,
  x: t.x * k,
  y: t.y * k,
  maxWidth: t.maxWidth * k,
});

const lineWidth = (t: TextBlock, measure: Measure) =>
  Math.min(t.maxWidth, measure(t.lines[0] ?? "", t.fontPx, t.bold));

/** Layout in reference units (width = 1000). */
const layoutReference = (board: Board, includeTitle: boolean, measure: Measure): BoardLayout => {
  const { cols, rows } = board.size;
  const width = REF_WIDTH;
  const gap = width * GAP_RATIO;
  const slot = width / cols; // each cell sits in a square slot, inset by gap / 2
  const size = slot - gap;
  const height = slot * rows;
  const byPos = new Map(board.cells.map((c) => [`${c.row},${c.col}`, c]));

  const cells: CellLayout[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * slot + gap / 2;
      const y = row * slot + gap / 2;
      const cell = byPos.get(`${row},${col}`);
      const r = size * 0.06;
      const top = row === 0;
      const bottom = row === rows - 1;
      const left = col === 0;
      const right = col === cols - 1;
      const radii: CornerRadii = [
        top && left ? r : 0,
        top && right ? r : 0,
        bottom && right ? r : 0,
        bottom && left ? r : 0,
      ];
      const base = { row, col, x, y, size, radii };
      const pad = size * 0.08;
      if (!cell) {
        cells.push({ ...base, kind: "empty" });
      } else if (cell.photoId) {
        const fontPx = size * 0.1;
        const text = textBlock(
          cell.title,
          {
            x: x + pad,
            y: 0,
            maxWidth: size - pad * 2,
            fontPx,
            maxLines: 2,
            bold: true,
            color: "#ffffff",
          },
          measure,
        );
        const bandHeight = text.lines.length * text.lineHeight + pad * 1.2;
        const bandY = y + size - bandHeight;
        text.y = bandY + pad * 0.6;
        cells.push({
          ...base,
          kind: "done",
          cell,
          caption: { y: bandY, height: bandHeight, color: CAPTION_BAND_COLOR },
          text,
        });
      } else {
        const info = CATEGORIES.find((c) => c.id === cell.category) ?? CATEGORIES[0];
        const stripH = size * 0.05;
        const labelFont = size * 0.09;
        const labelText = textBlock(
          info.label,
          {
            x: x + pad,
            y: y + stripH + pad * 0.6,
            maxWidth: size - pad * 2,
            fontPx: labelFont,
            maxLines: 1,
            bold: true,
            color: info.color,
          },
          measure,
        );
        const titleTop = labelText.y + labelText.lineHeight + pad * 0.4;
        const titleFont = size * 0.13;
        const lineHeight = titleFont * LINE_HEIGHT;
        const maxLines = Math.max(1, Math.floor((y + size - pad - titleTop) / lineHeight));
        const text = textBlock(
          cell.title,
          {
            x: x + pad,
            y: titleTop,
            maxWidth: size - pad * 2,
            fontPx: titleFont,
            maxLines,
            bold: true,
            color: TEXT_COLOR,
          },
          measure,
        );
        cells.push({
          ...base,
          kind: "todo",
          cell,
          band: {
            category: info.id,
            label: info.label,
            color: info.color,
            height: stripH,
            labelText,
          },
          text,
        });
      }
    }
  }

  let titleBand: TitleBand | undefined;
  if (includeTitle) {
    const fontPx = width * 0.05;
    const bandH = fontPx * 2.2;
    const tb = textBlock(
      board.title,
      {
        x: width * 0.05,
        y: (bandH - fontPx * LINE_HEIGHT) / 2,
        maxWidth: width * 0.9,
        fontPx,
        maxLines: 1,
        bold: true,
        color: "#ffffff",
      },
      measure,
    );
    tb.x = (width - lineWidth(tb, measure)) / 2; // centred
    titleBand = {
      x: 0,
      y: 0,
      width,
      height: bandH,
      color: TITLE_BAND_COLOR,
      text: board.title,
      textBlock: tb,
    };
  }

  return { width, height, gap, background: BOARD_BACKGROUND, cells, titleBand };
};

export const layoutBoard = (board: Board, opts: LayoutOptions): BoardLayout => {
  const ref = layoutReference(board, opts.includeTitle, opts.measure);
  const k = opts.width / REF_WIDTH;
  return {
    width: opts.width,
    height: ref.height * k,
    gap: ref.gap * k,
    background: ref.background,
    cells: ref.cells.map((c) => ({
      ...c,
      x: c.x * k,
      y: c.y * k,
      size: c.size * k,
      radii: c.radii.map((r) => r * k) as CornerRadii,
      band: c.band && {
        ...c.band,
        height: c.band.height * k,
        labelText: scaleText(c.band.labelText, k),
      },
      caption: c.caption && { ...c.caption, y: c.caption.y * k, height: c.caption.height * k },
      text: c.text && scaleText(c.text, k),
    })),
    titleBand: ref.titleBand && {
      ...ref.titleBand,
      width: opts.width,
      height: ref.titleBand.height * k,
      textBlock: scaleText(ref.titleBand.textBlock, k),
    },
  };
};

// ---- color contrast helpers (WCAG 2.1) ----

export type RGB = [number, number, number];

export const compositeOver = (fg: RGB, alpha: number, bg: RGB): RGB =>
  fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as RGB;

const luminance = ([r, g, b]: RGB) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export const contrastRatio = (a: RGB, b: RGB) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
