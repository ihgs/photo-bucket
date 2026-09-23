import type { Board, Photo } from "../src/domain/types";

export const fakePhoto = (id: string, boardId: string): Photo => ({
  id,
  boardId,
  blob: new Blob([`photo-${id}`], { type: "image/jpeg" }),
  thumbBlob: new Blob([`thumb-${id}`], { type: "image/jpeg" }),
  width: 400,
  height: 300,
});

export const makeBoard = (overrides: Partial<Board> = {}): Board => ({
  id: "b1",
  title: "テストボード",
  size: { cols: 3, rows: 4 },
  cells: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

/** Fixed-width measure: every character is one em wide. */
export const monoMeasure = (text: string, fontPx: number) => [...text].length * fontPx;
