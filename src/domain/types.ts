export interface GridSize {
  cols: number;
  rows: number;
}

export type Category = "want" | "go" | "eat" | "other";

export interface CategoryInfo {
  id: Category;
  label: string;
  /** Band / badge color. White text on it has contrast >= 4.5:1. */
  color: string;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { id: "want", label: "やりたい", color: "#c2410c" },
  { id: "go", label: "行きたい", color: "#1d4ed8" },
  { id: "eat", label: "食べたい", color: "#047857" },
  { id: "other", label: "その他", color: "#6b21a8" },
];

export const categoryInfo = (id: Category): CategoryInfo =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

/** Clockwise rotation of a photo in degrees. */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * Visible part of a photo inside a square cell. cx/cy: 0..1 of the rotated photo, zoom: 1..4.
 * `rotation` is absent (0) in data saved before rotation existed.
 */
export interface Crop {
  cx: number;
  cy: number;
  zoom: number;
  rotation?: Rotation;
}

export interface Cell {
  id: string;
  row: number;
  col: number;
  title: string;
  category: Category;
  memo?: string;
  photoId?: string;
  crop?: Crop;
  achievedAt?: string;
}

export interface Board {
  id: string;
  title: string;
  size: GridSize;
  cells: Cell[];
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  boardId: string;
  blob: Blob;
  width: number;
  height: number;
  thumbBlob: Blob;
}

export interface Preferences {
  exportIncludeTitle: boolean;
  lastBackupAt: string | null;
  lastOpenedBoardId: string | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  exportIncludeTitle: true,
  lastBackupAt: null,
  lastOpenedBoardId: null,
};
