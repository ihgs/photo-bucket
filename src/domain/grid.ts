import { DEFAULT_CROP } from "./crop";
import type { Board, Category, Cell, Crop, GridSize } from "./types";

export const GRID_SIZES: readonly GridSize[] = [
  { cols: 3, rows: 3 },
  { cols: 4, rows: 4 },
  { cols: 5, rows: 5 },
  { cols: 3, rows: 4 },
  { cols: 4, rows: 3 },
];

export const DEFAULT_GRID_SIZE: GridSize = { cols: 5, rows: 5 };

export const isValidGridSize = (size: unknown): size is GridSize =>
  typeof size === "object" &&
  size !== null &&
  GRID_SIZES.some(
    (s) =>
      s.cols === (size as GridSize).cols &&
      s.rows === (size as GridSize).rows &&
      Object.keys(size).length === 2,
  );

/** "横の列数×縦の行数" */
export const gridLabel = (size: GridSize) => `${size.cols}×${size.rows}`;

export const aspectRatio = (size: GridSize) => size.cols / size.rows;

export const totalCells = (size: GridSize) => size.cols * size.rows;

export const countAchieved = (board: Board) => board.cells.filter((c) => c.photoId).length;

export const findCell = (board: Board, row: number, col: number): Cell | undefined =>
  board.cells.find((c) => c.row === row && c.col === col);

export const isInside = (size: GridSize, row: number, col: number) =>
  Number.isInteger(row) &&
  Number.isInteger(col) &&
  row >= 0 &&
  col >= 0 &&
  row < size.rows &&
  col < size.cols;

// ---- editing (pure; each returns a new board) ----

export interface CellEdit {
  title: string;
  category: Category;
  memo?: string;
}

export interface Position {
  row: number;
  col: number;
}

export interface EditResult {
  board: Board;
  /** Photos that are no longer referenced and must be deleted from storage. */
  removedPhotoIds: string[];
}

export const upsertCell = (
  board: Board,
  row: number,
  col: number,
  edit: CellEdit,
  newId: () => string = () => crypto.randomUUID(),
): Board => {
  if (!isInside(board.size, row, col)) throw new RangeError("position outside the grid");
  const fields = { title: edit.title.trim(), category: edit.category, memo: edit.memo ?? "" };
  const existing = findCell(board, row, col);
  const cells = existing
    ? board.cells.map((c) => (c === existing ? { ...c, ...fields } : c))
    : [...board.cells, { id: newId(), row, col, ...fields }];
  return { ...board, cells };
};

const photoIdsOf = (cells: readonly Cell[]) => cells.flatMap((c) => (c.photoId ? [c.photoId] : []));

export const removeCell = (board: Board, row: number, col: number): EditResult => {
  const target = findCell(board, row, col);
  if (!target) return { board, removedPhotoIds: [] };
  return {
    board: { ...board, cells: board.cells.filter((c) => c !== target) },
    removedPhotoIds: photoIdsOf([target]),
  };
};

export const swapCells = (board: Board, a: Position, b: Position): Board => {
  if (!isInside(board.size, a.row, a.col) || !isInside(board.size, b.row, b.col))
    throw new RangeError("position outside the grid");
  const ca = findCell(board, a.row, a.col);
  const cb = findCell(board, b.row, b.col);
  if (!ca && !cb) return board;
  return {
    ...board,
    cells: board.cells.map((c) => {
      if (c === ca) return { ...c, row: b.row, col: b.col };
      if (c === cb) return { ...c, row: a.row, col: a.col };
      return c;
    }),
  };
};

export const cellsOutside = (board: Board, size: GridSize) =>
  board.cells.filter((c) => !isInside(size, c.row, c.col));

export const resizeBoard = (board: Board, size: GridSize): EditResult => {
  if (!isValidGridSize(size)) throw new RangeError("unsupported grid size");
  const outside = new Set(cellsOutside(board, size));
  return {
    board: {
      ...board,
      size: { cols: size.cols, rows: size.rows },
      cells: board.cells.filter((c) => !outside.has(c)),
    },
    removedPhotoIds: photoIdsOf([...outside]),
  };
};

/** Attaches (or replaces) the photo of a filled cell. achievedAt is kept on replace (data-model.md). */
export const setCellPhoto = (
  board: Board,
  row: number,
  col: number,
  photoId: string,
  now: string = new Date().toISOString(),
): EditResult => {
  const target = findCell(board, row, col);
  if (!target) throw new RangeError("写真を貼れるのは項目の入ったマスだけです");
  const next: Cell = {
    ...target,
    photoId,
    crop: { ...DEFAULT_CROP },
    achievedAt: target.achievedAt ?? now,
  };
  return {
    board: { ...board, cells: board.cells.map((c) => (c === target ? next : c)) },
    removedPhotoIds: target.photoId && target.photoId !== photoId ? [target.photoId] : [],
  };
};

export const clearCellPhoto = (board: Board, row: number, col: number): EditResult => {
  const target = findCell(board, row, col);
  if (!target?.photoId) return { board, removedPhotoIds: [] };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { photoId, crop, achievedAt, ...rest } = target;
  return {
    board: { ...board, cells: board.cells.map((c) => (c === target ? rest : c)) },
    removedPhotoIds: [photoId],
  };
};

export const setCellCrop = (board: Board, row: number, col: number, crop: Crop): Board => {
  const target = findCell(board, row, col);
  if (!target?.photoId) return board;
  return {
    ...board,
    cells: board.cells.map((c) => (c === target ? { ...c, crop: { ...crop } } : c)),
  };
};
