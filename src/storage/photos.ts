import { clearCellPhoto, setCellPhoto } from "../domain/grid";
import type { Board, Photo } from "../domain/types";
import { saveBoard } from "./boards";
import { getDb, withQuotaGuard, type StoredPhoto, type WriteTx } from "./db";

/** A photo after decoding and resizing, before it belongs to a board. */
export interface ImportedPhoto {
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
}

export const deletePhotosInTx = async (tx: WriteTx, ids: readonly string[]) => {
  const store = tx.objectStore("photos");
  await Promise.all(ids.map((id) => store.delete(id)));
  releasePhotoUrls(ids);
};

export const deletePhotosOfBoardInTx = async (tx: WriteTx, boardId: string) => {
  const store = tx.objectStore("photos");
  const keys = await store.index("byBoard").getAllKeys(boardId);
  await Promise.all(keys.map((k) => store.delete(k)));
  releasePhotoUrls(keys);
};

export const deletePhotos = (ids: readonly string[]) =>
  withQuotaGuard(async () => {
    const db = await getDb();
    const tx = db.transaction(["photos"], "readwrite");
    await deletePhotosInTx(tx, ids);
    await tx.done;
  });

export const deletePhotosOfBoard = (boardId: string) =>
  withQuotaGuard(async () => {
    const db = await getDb();
    const tx = db.transaction(["photos"], "readwrite");
    await deletePhotosOfBoardInTx(tx, boardId);
    await tx.done;
  });

export const newPhotoRecord = (boardId: string, imported: ImportedPhoto): Photo => ({
  id: crypto.randomUUID(),
  boardId,
  blob: imported.blob,
  thumbBlob: imported.thumbBlob,
  width: imported.width,
  height: imported.height,
});

/** Attaches or replaces the photo of a filled cell, in one transaction with the board. */
export const attachPhoto = async (
  board: Board,
  row: number,
  col: number,
  imported: ImportedPhoto,
  now?: string,
) => {
  const photo = newPhotoRecord(board.id, imported);
  const r = setCellPhoto(board, row, col, photo.id, now);
  return saveBoard(r.board, { putPhotos: [photo], deletePhotoIds: r.removedPhotoIds });
};

export const detachPhoto = async (board: Board, row: number, col: number) => {
  const r = clearCellPhoto(board, row, col);
  return saveBoard(r.board, { deletePhotoIds: r.removedPhotoIds });
};

/** Converts a photo for storage. Must run before a transaction starts (it awaits blob reads). */
export const toStored = async (p: Photo): Promise<StoredPhoto> => ({
  id: p.id,
  boardId: p.boardId,
  type: p.blob.type || "image/jpeg",
  bytes: await p.blob.arrayBuffer(),
  thumbBytes: await p.thumbBlob.arrayBuffer(),
  width: p.width,
  height: p.height,
});

export const fromStored = (s: StoredPhoto): Photo => ({
  id: s.id,
  boardId: s.boardId,
  blob: new Blob([s.bytes], { type: s.type }),
  thumbBlob: new Blob([s.thumbBytes], { type: "image/jpeg" }),
  width: s.width,
  height: s.height,
});

export const getPhoto = async (id: string) => {
  const stored = await (await getDb()).get("photos", id);
  return stored && fromStored(stored);
};

export const getPhotosOfBoard = async (boardId: string) =>
  (await (await getDb()).getAllFromIndex("photos", "byBoard", boardId)).map(fromStored);

/** Stores photos directly (used by backups and tests). */
export const putPhotos = (photos: readonly Photo[]) =>
  withQuotaGuard(async () => {
    const stored = await Promise.all(photos.map(toStored));
    const db = await getDb();
    const tx = db.transaction(["photos"], "readwrite");
    await Promise.all(stored.map((p) => tx.objectStore("photos").put(p)));
    await tx.done;
  });

// ---- object URLs for display ----

export interface PhotoUrl {
  url: string;
  width: number;
  height: number;
}

const urls = new Map<string, Promise<PhotoUrl | null>>();

const loadUrl = (id: string, kind: "thumb" | "full") => {
  const key = `${kind}:${id}`;
  let p = urls.get(key);
  if (!p) {
    p = getPhoto(id).then((photo) => {
      if (!photo) {
        urls.delete(key); // not saved yet (or deleted): do not cache the miss
        return null;
      }
      return {
        url: URL.createObjectURL(kind === "thumb" ? photo.thumbBlob : photo.blob),
        width: photo.width,
        height: photo.height,
      };
    });
    urls.set(key, p);
  }
  return p;
};

/** Object URL of the thumbnail (cached until the photo is deleted). */
export const getThumbUrl = (id: string) => loadUrl(id, "thumb");
/** Object URL of the full-size photo (cached until the photo is deleted). */
export const getFullUrl = (id: string) => loadUrl(id, "full");

/** Makes a photo displayable right away, before its save has finished. */
export const primePhotoUrls = (photo: Photo) => {
  for (const kind of ["thumb", "full"] as const) {
    const key = `${kind}:${photo.id}`;
    if (urls.has(key)) continue;
    urls.set(
      key,
      Promise.resolve({
        url: URL.createObjectURL(kind === "thumb" ? photo.thumbBlob : photo.blob),
        width: photo.width,
        height: photo.height,
      }),
    );
  }
};

export const releasePhotoUrls = (ids: readonly string[]) => {
  for (const id of ids) {
    for (const kind of ["thumb", "full"]) {
      const key = `${kind}:${id}`;
      const p = urls.get(key);
      if (!p) continue;
      urls.delete(key);
      void p.then((u) => u && URL.revokeObjectURL(u.url));
    }
  }
};
