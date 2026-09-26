import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from "idb";
import type { Board, Preferences } from "../domain/types";

export interface PhotoBucketDB extends DBSchema {
  boards: { key: string; value: Board };
  photos: {
    key: string;
    value: StoredPhoto;
    indexes: { byBoard: string; byBoardSize: [string, number] };
  };
  meta: { key: string; value: unknown };
}

export const DB_NAME = "photo-bucket";

/**
 * Photos are stored as ArrayBuffers, not Blobs: Safari cannot store Blobs in IndexedDB in private
 * browsing ("Error preparing Blob/File data to be stored in object store").
 */
export interface StoredPhoto {
  id: string;
  boardId: string;
  type: string;
  bytes: ArrayBuffer;
  thumbBytes: ArrayBuffer;
  /** Size of `bytes` (not the thumbnail), indexed with boardId to total a board without reading it. */
  byteLength: number;
  width: number;
  height: number;
}

export type UpgradeTx = IDBPTransaction<
  PhotoBucketDB,
  ArrayLike<StoreNames<PhotoBucketDB>>,
  "versionchange"
>;
export type WriteTx = IDBPTransaction<
  PhotoBucketDB,
  ArrayLike<StoreNames<PhotoBucketDB>>,
  "readwrite"
>;

/**
 * A migration upgrades the schema from version i to i + 1 (index i). An async migration may only
 * await IndexedDB requests of `tx`, or the upgrade transaction closes under it.
 */
export type Migration = (db: IDBPDatabase<PhotoBucketDB>, tx: UpgradeTx) => void | Promise<void>;

export const MIGRATIONS: Migration[] = [
  // 0 → 1: initial schema
  (db) => {
    db.createObjectStore("boards", { keyPath: "id" });
    const photos = db.createObjectStore("photos", { keyPath: "id" });
    photos.createIndex("byBoard", "boardId");
    db.createObjectStore("meta");
  },
  // 1 → 2: photo byteLength + byBoardSize index; exportLog seeded from lastBackupAt (003)
  async (_db, tx) => {
    const photos = tx.objectStore("photos");
    for (let c = await photos.openCursor(); c; c = await c.continue())
      await c.update({ ...c.value, byteLength: c.value.bytes.byteLength });
    photos.createIndex("byBoardSize", ["boardId", "byteLength"]);

    const meta = tx.objectStore("meta");
    const prefs = (await meta.get("preferences")) as Partial<Preferences> | undefined;
    const at = prefs?.lastBackupAt;
    if (!at) return;
    const log: Record<string, string> = {};
    for (const b of await tx.objectStore("boards").getAll()) if (b.updatedAt <= at) log[b.id] = at;
    await meta.put(log, "exportLog");
  },
];

export const openPhotoBucketDB = (name = DB_NAME, migrations = MIGRATIONS) =>
  openDB<PhotoBucketDB>(name, migrations.length, {
    upgrade(db, oldVersion, newVersion, tx) {
      const target = newVersion ?? migrations.length;
      void (async () => {
        for (let v = oldVersion; v < target; v++) await migrations[v](db, tx);
        await tx.objectStore("meta").put(target, "schemaVersion");
      })().catch(() => tx.abort());
    },
    blocking() {
      // A newer version of the app wants to upgrade: let it.
      cached?.then((db) => db.close());
      cached = null;
    },
  });

let cached: Promise<IDBPDatabase<PhotoBucketDB>> | null = null;

export const getDb = () => (cached ??= openPhotoBucketDB());

/** Test helper: closes and deletes the database. */
export const resetDbForTests = async () => {
  if (cached) (await cached).close();
  cached = null;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
};

export class StorageFullError extends Error {
  constructor(cause?: unknown) {
    super("端末の保存容量が足りません", { cause });
    this.name = "StorageFullError";
  }
}

const isQuotaError = (e: unknown) =>
  e instanceof Error || e instanceof DOMException
    ? (e as { name: string }).name === "QuotaExceededError"
    : false;

export const withQuotaGuard = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (isQuotaError(e)) throw new StorageFullError(e);
    throw e;
  }
};
