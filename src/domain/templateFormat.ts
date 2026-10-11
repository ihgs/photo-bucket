import { GRID_SIZES, gridLabel, isValidGridSize } from "./grid";
import type { BoardTemplate, TemplateItem } from "./templates";
import { CATEGORIES, type Category } from "./types";
import { BOARD_TITLE_MAX, CELL_TITLE_MAX, charLength } from "./validation";

/** The format templates are shared in (specs/006-template-import/contracts/template-format.md). */
export const TEMPLATE_FORMAT = "bucket-grid-template";
export const TEMPLATE_FORMAT_VERSION = 1;
export const TEMPLATE_MAX_BYTES = 102_400;
export const TEMPLATE_NAME_MAX = 20;
export const TEMPLATE_DESCRIPTION_MAX = 60;

const MAX_SHOWN_ERRORS = 5;

export const TOO_LARGE = "大きすぎます（100 KB まで）";
const CATEGORY_HINT =
  "want・go・eat・other（やりたい・行きたい・食べたい・その他）のどれかにしてください";

export type ParseResult = { ok: true; template: BoardTemplate } | { ok: false; errors: string[] };

const fail = (...errors: string[]): ParseResult => ({ ok: false, errors });

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Accepts the ids (want…) and the labels shown on screen (やりたい…). */
const toCategory = (v: unknown): Category | null =>
  CATEGORIES.find((c) => c.id === v || c.label === v)?.id ?? null;

/** Trimmed text of 1..max characters (0..max when optional), or the message to show. */
const text = (
  v: unknown,
  label: string,
  max: number,
  optional = false,
): { value: string } | { error: string } => {
  if (v === undefined && optional) return { value: "" };
  const value = typeof v === "string" ? v.trim() : "";
  if (!value && !optional) return { error: `${label}を入れてください` };
  if (charLength(value) > max) return { error: `${label}は${max}文字以内にしてください` };
  return { value };
};

/** Reads a template shared as text (pasted or loaded from a URL) and checks every rule. */
export const parseTemplate = (input: string): ParseResult => {
  if (new TextEncoder().encode(input).length > TEMPLATE_MAX_BYTES) return fail(TOO_LARGE);

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch {
    return fail("テンプレートの形式ではありません（JSON として読めません）");
  }
  if (!isObject(data) || data.format !== TEMPLATE_FORMAT)
    return fail(
      `テンプレートの形式ではありません（"format" が "${TEMPLATE_FORMAT}" ではありません）`,
    );
  if (typeof data.version === "number" && data.version > TEMPLATE_FORMAT_VERSION)
    return fail("新しい形式のため取り込めません。アプリを更新してください");
  if (data.version !== TEMPLATE_FORMAT_VERSION) return fail(`"version" は 1 にしてください`);

  const name = text(data.name, "名前", TEMPLATE_NAME_MAX);
  const title = text(data.title, "タイトル", BOARD_TITLE_MAX);
  const description = text(data.description, "説明", TEMPLATE_DESCRIPTION_MAX, true);
  const defaultCategory = data.category === undefined ? "want" : toCategory(data.category);
  const headerErrors = [name, title, description].flatMap((r) => ("error" in r ? [r.error] : []));
  if (defaultCategory === null) headerErrors.push(`"category" は ${CATEGORY_HINT}`);
  if ("error" in name || "error" in title || "error" in description || defaultCategory === null)
    return fail(...headerErrors);

  const rows = data.rows;
  if (!Array.isArray(rows) || rows.length === 0 || !rows.every(Array.isArray))
    return fail(`"rows" にマス目を書いてください`);
  const cols = (rows[0] as unknown[]).length;
  const uneven = rows.findIndex((r: unknown[]) => r.length !== cols);
  if (uneven >= 0) return fail(`1 行のマスの数がそろっていません（${uneven + 1} 行目）`);
  const size = { cols, rows: rows.length };
  if (!isValidGridSize(size))
    return fail(
      `マス目のサイズ ${gridLabel(size)} は使えません（${GRID_SIZES.map(gridLabel).join("・")}）`,
    );

  const items: TemplateItem[] = [];
  const cellErrors: string[] = [];
  (rows as unknown[][]).forEach((cells, row) =>
    cells.forEach((cell, col) => {
      if (cell === null) return;
      const at = `${row + 1} 行目 ${col + 1} 列目: `;
      const fields = typeof cell === "string" ? { title: cell } : isObject(cell) ? cell : null;
      if (!fields) {
        cellErrors.push(`${at}文字列か {"title", "category"} か null にしてください`);
        return;
      }
      const t = text(fields.title, "タイトル", CELL_TITLE_MAX);
      if ("error" in t) cellErrors.push(at + t.error);
      const category =
        fields.category === undefined ? defaultCategory : toCategory(fields.category);
      if (category === null) cellErrors.push(`${at}カテゴリは ${CATEGORY_HINT}`);
      if ("value" in t && category) items.push({ row, col, title: t.value, category });
    }),
  );
  if (cellErrors.length > MAX_SHOWN_ERRORS)
    return fail(
      ...cellErrors.slice(0, MAX_SHOWN_ERRORS),
      `ほか ${cellErrors.length - MAX_SHOWN_ERRORS} 件`,
    );
  if (cellErrors.length > 0) return fail(...cellErrors);
  if (items.length === 0) return fail("項目が 1 つもありません");

  return {
    ok: true,
    template: {
      id: "imported",
      imported: true,
      name: name.value,
      title: title.value,
      description: description.value,
      size,
      items,
    },
  };
};
