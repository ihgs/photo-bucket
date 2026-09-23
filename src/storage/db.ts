import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from "idb";
import type { Board } from "../domain/types";

export interface PhotoBucketDB extends DBSchema {
  boards: { key: string; value: Board };
  photos: { key: string; value: StoredPhoto; indexes: { byBoard: string } };
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

/** A migration upgrades the schema from version i to i + 1 (index i). */
export type Migration = (db: IDBPDatabase<PhotoBucketDB>, tx: UpgradeTx) => void;

export const MIGRATIONS: Migration[] = [
  // 0 → 1: initial schema
  (db) => {
    db.createObjectStore("boards", { keyPath: "id" });
    const photos = db.createObjectStore("photos", { keyPath: "id" });
    photos.createIndex("byBoard", "boardId");
    db.createObjectStore("meta");
  },
];

export const openPhotoBucketDB = (name = DB_NAME, migrations = MIGRATIONS) =>
  openDB<PhotoBucketDB>(name, migrations.length, {
    upgrade(db, oldVersion, newVersion, tx) {
      const target = newVersion ?? migrations.length;
      for (let v = oldVersion; v < target; v++) migrations[v](db, tx);
      void tx.objectStore("meta").put(target, "schemaVersion");
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
