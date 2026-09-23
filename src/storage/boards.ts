import type { Board, GridSize, Photo } from "../domain/types";
import { normalizeBoardTitle } from "../domain/validation";
import { getDb, withQuotaGuard } from "./db";
import { deletePhotosInTx, deletePhotosOfBoardInTx, toStored } from "./photos";

const now = () => new Date().toISOString();

/** Strictly increasing timestamp so ordering by updatedAt is stable within one millisecond. */
let lastStamp = "";
const nextStamp = () => {
  let stamp = now();
  if (stamp <= lastStamp) stamp = new Date(Date.parse(lastStamp) + 1).toISOString();
  lastStamp = stamp;
  return stamp;
};

export const createBoard = (title: string, size: GridSize) =>
  withQuotaGuard(async () => {
    const stamp = nextStamp();
    const board: Board = {
      id: crypto.randomUUID(),
      title: normalizeBoardTitle(title),
      size: { cols: size.cols, rows: size.rows },
      cells: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    const db = await getDb();
    await db.put("boards", board);
    return board;
  });

export const getBoard = async (id: string) => (await getDb()).get("boards", id);

/** All boards, most recently updated first. Photo blobs are not loaded. */
export const listBoards = async () => {
  const boards = await (await getDb()).getAll("boards");
  return boards.sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
};

export interface SaveOptions {
  putPhotos?: readonly Photo[];
  deletePhotoIds?: readonly string[];
}

/** Saves the board (bumping updatedAt) and photo changes in one transaction. */
export const saveBoard = (board: Board, opts: SaveOptions = {}) =>
  withQuotaGuard(async () => {
    const photos = await Promise.all((opts.putPhotos ?? []).map(toStored));
    const db = await getDb();
    const saved: Board = { ...board, updatedAt: nextStamp() };
    const tx = db.transaction(["boards", "photos"], "readwrite");
    try {
      await deletePhotosInTx(tx, opts.deletePhotoIds ?? []);
      await Promise.all(photos.map((p) => tx.objectStore("photos").put(p)));
      await tx.objectStore("boards").put(saved);
      await tx.done;
    } catch (e) {
      try {
        tx.abort();
      } catch {
        // already finished
      }
      await tx.done.catch(() => undefined);
      throw e;
    }
    return saved;
  });

export const deleteBoard = (id: string) =>
  withQuotaGuard(async () => {
    const db = await getDb();
    const tx = db.transaction(["boards", "photos"], "readwrite");
    await deletePhotosOfBoardInTx(tx, id);
    await tx.objectStore("boards").delete(id);
    await tx.done;
  });
