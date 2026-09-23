import { isInside, isValidGridSize } from "./grid";
import { CATEGORIES } from "./types";

export const BOARD_TITLE_MAX = 40;
export const CELL_TITLE_MAX = 60;
export const MEMO_MAX = 500;
export const UNTITLED_BOARD = "無題のボード";

/** Length in user-perceived characters (code points). */
export const charLength = (s: string) => [...s].length;

export const normalizeBoardTitle = (title: string) => {
  const trimmed = title.trim();
  if (!trimmed) return UNTITLED_BOARD;
  return [...trimmed].slice(0, BOARD_TITLE_MAX).join("");
};

export interface CellInput {
  title: string;
  category: string;
  memo?: string;
}

/** Returns a Japanese error message, or null when valid. */
export const validateCellInput = (input: CellInput): string | null => {
  const title = input.title.trim();
  if (!title) return "タイトルを入力してください";
  if (charLength(title) > CELL_TITLE_MAX)
    return `タイトルは${CELL_TITLE_MAX}文字以内にしてください`;
  if (!CATEGORIES.some((c) => c.id === input.category)) return "カテゴリを選んでください";
  if (input.memo !== undefined && charLength(input.memo) > MEMO_MAX)
    return `メモは${MEMO_MAX}文字以内にしてください`;
  return null;
};

const isString = (v: unknown): v is string => typeof v === "string";
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const inRange = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

/** Validates an unknown value as a Board. Returns a list of Japanese error messages. */
export const validateBoard = (value: unknown): string[] => {
  const errors: string[] = [];
  if (!isObject(value)) return ["ボードの形式が正しくありません"];
  const b = value;
  if (!isString(b.id) || !b.id) errors.push("ボードの ID がありません");
  if (!isString(b.title) || charLength(b.title) > BOARD_TITLE_MAX)
    errors.push("ボードのタイトルが正しくありません");
  if (!isString(b.createdAt) || !isString(b.updatedAt)) errors.push("ボードの日時がありません");
  if (!isValidGridSize(b.size)) {
    errors.push("マス目のサイズが正しくありません");
    return errors;
  }
  const size = b.size;
  if (!Array.isArray(b.cells)) {
    errors.push("マスの一覧がありません");
    return errors;
  }
  const seen = new Set<string>();
  const ids = new Set<string>();
  b.cells.forEach((cell: unknown, i: number) => {
    const where = `${i + 1}番目のマス`;
    if (!isObject(cell)) {
      errors.push(`${where}の形式が正しくありません`);
      return;
    }
    if (!isString(cell.id) || !cell.id || ids.has(cell.id))
      errors.push(`${where}の ID が正しくありません`);
    else ids.add(cell.id);
    const row = cell.row as number;
    const col = cell.col as number;
    if (!isInside(size, row, col)) errors.push(`${where}の位置がマス目の外です`);
    const key = `${row},${col}`;
    if (seen.has(key)) errors.push(`${where}の位置が重複しています`);
    seen.add(key);
    const msg = validateCellInput({
      title: isString(cell.title) ? cell.title : "",
      category: isString(cell.category) ? cell.category : "",
      memo:
        cell.memo === undefined
          ? undefined
          : isString(cell.memo)
            ? cell.memo
            : "x".repeat(MEMO_MAX + 1),
    });
    if (msg) errors.push(`${where}: ${msg}`);
    if (cell.photoId !== undefined) {
      if (!isString(cell.photoId) || !cell.photoId)
        errors.push(`${where}の写真 ID が正しくありません`);
      const crop = cell.crop;
      if (
        !isObject(crop) ||
        !inRange(crop.cx, 0, 1) ||
        !inRange(crop.cy, 0, 1) ||
        !inRange(crop.zoom, 1, 4)
      )
        errors.push(`${where}の表示範囲が正しくありません`);
      if (!isString(cell.achievedAt)) errors.push(`${where}の達成日がありません`);
    }
  });
  return errors;
};
