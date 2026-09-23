import { afterEach, describe, expect, it } from "vitest";
import {
  MIGRATIONS,
  StorageFullError,
  openPhotoBucketDB,
  withQuotaGuard,
} from "../../src/storage/db";

let counter = 0;
const uniqueName = () => `test-db-${Date.now()}-${counter++}`;
const opened: { close(): void }[] = [];
afterEach(() => opened.splice(0).forEach((db) => db.close()));

describe("database schema", () => {
  it("creates the stores and records schemaVersion 1", async () => {
    const db = await openPhotoBucketDB(uniqueName());
    opened.push(db);
    expect([...db.objectStoreNames].sort()).toEqual(["boards", "meta", "photos"]);
    const tx = db.transaction("photos");
    expect([...tx.store.indexNames]).toEqual(["byBoard"]);
    expect(tx.store.keyPath).toBe("id");
    expect(await db.get("meta", "schemaVersion")).toBe(1);
    expect(MIGRATIONS.length).toBe(1);
  });

  it("applies migrations in order from the stored version", async () => {
    const name = uniqueName();
    const v1 = await openPhotoBucketDB(name);
    await v1.put("boards", {
      id: "b1",
      title: "old",
      size: { cols: 3, rows: 3 },
      cells: [],
      createdAt: "x",
      updatedAt: "x",
    });
    v1.close();

    const applied: number[] = [];
    const v2 = await openPhotoBucketDB(name, [
      (db, tx) => {
        applied.push(1);
        MIGRATIONS[0](db, tx);
      },
      (_db, tx) => {
        applied.push(2);
        void tx.objectStore("boards").put({
          id: "b2",
          title: "migrated",
          size: { cols: 3, rows: 3 },
          cells: [],
          createdAt: "x",
          updatedAt: "x",
        });
      },
    ]);
    opened.push(v2);
    expect(applied).toEqual([2]);
    expect(await v2.get("meta", "schemaVersion")).toBe(2);
    expect((await v2.getAllKeys("boards")).sort()).toEqual(["b1", "b2"]);
  });
});

describe("withQuotaGuard", () => {
  it("converts QuotaExceededError to StorageFullError", async () => {
    const quota = new DOMException("full", "QuotaExceededError");
    await expect(withQuotaGuard(() => Promise.reject(quota))).rejects.toBeInstanceOf(
      StorageFullError,
    );
  });
  it("passes other errors through", async () => {
    const other = new Error("other");
    await expect(withQuotaGuard(() => Promise.reject(other))).rejects.toBe(other);
  });
});
