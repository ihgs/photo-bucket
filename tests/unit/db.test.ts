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
  it("creates the stores and records schemaVersion 2", async () => {
    const db = await openPhotoBucketDB(uniqueName());
    opened.push(db);
    expect([...db.objectStoreNames].sort()).toEqual(["boards", "meta", "photos"]);
    const tx = db.transaction("photos");
    expect([...tx.store.indexNames].sort()).toEqual(["byBoard", "byBoardSize"]);
    expect(tx.store.keyPath).toBe("id");
    expect(await db.get("meta", "schemaVersion")).toBe(2);
    expect(MIGRATIONS.length).toBe(2);
  });

  it("migrates 1 → 2: photo byteLength, byBoardSize index and exportLog from lastBackupAt", async () => {
    const name = uniqueName();
    const v1 = await openPhotoBucketDB(name, MIGRATIONS.slice(0, 1));
    const bytes = Uint8Array.from({ length: 1234 }, (_, i) => i % 256).buffer;
    const board = (id: string, updatedAt: string) => ({
      id,
      title: id,
      size: { cols: 3, rows: 3 },
      cells: [],
      createdAt: updatedAt,
      updatedAt,
    });
    await v1.put("boards", board("old", "2026-01-01T00:00:00.000Z"));
    await v1.put("boards", board("new", "2026-03-01T00:00:00.000Z"));
    const legacy = { id: "p1", boardId: "old", type: "image/jpeg", bytes, thumbBytes: bytes };
    await v1.put("photos", { ...legacy, width: 10, height: 10 } as never);
    await v1.put("meta", { lastBackupAt: "2026-02-01T00:00:00.000Z" }, "preferences");
    v1.close();

    const v2 = await openPhotoBucketDB(name);
    opened.push(v2);
    expect(await v2.get("meta", "schemaVersion")).toBe(2);
    const photo = await v2.get("photos", "p1");
    expect(photo?.byteLength).toBe(1234);
    expect(new Uint8Array(photo!.bytes)).toEqual(new Uint8Array(bytes));
    const tx = v2.transaction("photos");
    const cursor = await tx.store.index("byBoardSize").openKeyCursor();
    expect(cursor?.key).toEqual(["old", 1234]);
    expect(await v2.get("meta", "exportLog")).toEqual({ old: "2026-02-01T00:00:00.000Z" });
  });

  it("does not create an exportLog when there was no backup", async () => {
    const name = uniqueName();
    (await openPhotoBucketDB(name, MIGRATIONS.slice(0, 1))).close();
    const v2 = await openPhotoBucketDB(name);
    opened.push(v2);
    expect(await v2.get("meta", "exportLog")).toBeUndefined();
  });

  it("applies migrations in order from the stored version", async () => {
    const name = uniqueName();
    const v1 = await openPhotoBucketDB(name, MIGRATIONS.slice(0, 1));
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
