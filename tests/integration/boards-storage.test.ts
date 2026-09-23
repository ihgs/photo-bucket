import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../../src/storage/db";
import {
  createBoard,
  deleteBoard,
  getBoard,
  listBoards,
  saveBoard,
} from "../../src/storage/boards";
import { fakePhoto } from "../helpers";
import { putPhotos } from "../../src/storage/photos";

beforeEach(async () => {
  await resetDbForTests();
});

describe("board storage", () => {
  it("creates, reads, updates and lists boards", async () => {
    const a = await createBoard("A", { cols: 3, rows: 4 });
    expect(a.cells).toEqual([]);
    expect(await getBoard(a.id)).toEqual(a);

    await new Promise((r) => setTimeout(r, 5));
    const b = await createBoard("B", { cols: 5, rows: 5 });
    expect((await listBoards()).map((x) => x.id)).toEqual([b.id, a.id]);

    await new Promise((r) => setTimeout(r, 5));
    const updated = await saveBoard({ ...a, title: "A2" });
    expect(updated.updatedAt > a.updatedAt).toBe(true);
    expect((await listBoards()).map((x) => x.id)).toEqual([a.id, b.id]);
    expect((await getBoard(a.id))?.title).toBe("A2");
  });

  it("deletes a board together with its photos", async () => {
    const a = await createBoard("A", { cols: 3, rows: 3 });
    const db = await getDb();
    await putPhotos([fakePhoto("p1", a.id)]);
    await putPhotos([fakePhoto("p2", "other")]);
    await deleteBoard(a.id);
    expect(await getBoard(a.id)).toBeUndefined();
    expect(await db.getAllKeys("photos")).toEqual(["p2"]);
  });

  it("saves the board and photo changes in one transaction", async () => {
    const a = await createBoard("A", { cols: 3, rows: 3 });
    const db = await getDb();
    await putPhotos([fakePhoto("old", a.id)]);
    await saveBoard(a, { putPhotos: [fakePhoto("new", a.id)], deletePhotoIds: ["old"] });
    expect(await db.getAllKeys("photos")).toEqual(["new"]);
  });

  it("keeps existing data when a save fails", async () => {
    const a = await createBoard("A", { cols: 3, rows: 3 });
    const db = await getDb();
    await putPhotos([fakePhoto("p1", a.id)]);
    const broken = { ...a, title: "broken", bad: () => 1 } as unknown as typeof a;
    await expect(saveBoard(broken, { deletePhotoIds: ["p1"] })).rejects.toBeTruthy();
    expect((await getBoard(a.id))?.title).toBe("A");
    expect(await db.getAllKeys("photos")).toEqual(["p1"]);
  });
});
