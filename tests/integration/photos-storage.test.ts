import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../../src/storage/db";
import {
  attachPhoto,
  deletePhotos,
  deletePhotosOfBoard,
  detachPhoto,
  getPhoto,
  putPhotos,
} from "../../src/storage/photos";
import { createBoard, getBoard, saveBoard } from "../../src/storage/boards";
import { upsertCell } from "../../src/domain/grid";
import { fakePhoto } from "../helpers";

beforeEach(async () => {
  await resetDbForTests();
});

describe("photo deletion", () => {
  it("deletes photos by id", async () => {
    const db = await getDb();
    await putPhotos([fakePhoto("p1", "b1")]);
    await putPhotos([fakePhoto("p2", "b1")]);
    await deletePhotos(["p1"]);
    expect(await db.getAllKeys("photos")).toEqual(["p2"]);
  });

  it("deletes all photos of a board", async () => {
    const db = await getDb();
    await putPhotos([fakePhoto("p1", "b1")]);
    await putPhotos([fakePhoto("p2", "b1")]);
    await putPhotos([fakePhoto("p3", "b2")]);
    await deletePhotosOfBoard("b1");
    expect(await db.getAllKeys("photos")).toEqual(["p3"]);
  });
});

const imported = (tag: string) => ({
  blob: new Blob([`full-${tag}`], { type: "image/jpeg" }),
  thumbBlob: new Blob([`thumb-${tag}`], { type: "image/jpeg" }),
  width: 1600,
  height: 1200,
});

describe("attach / replace / detach", () => {
  it("attaches a photo, keeps achievedAt on replace, and cleans up on detach", async () => {
    let board = await createBoard("A", { cols: 3, rows: 3 });
    board = await saveBoard(upsertCell(board, 1, 1, { title: "登山", category: "go" }));

    board = await attachPhoto(board, 1, 1, imported("1"), "2026-05-01T00:00:00.000Z");
    const first = board.cells[0];
    expect(first.photoId).toBeTruthy();
    expect(first.crop).toEqual({ cx: 0.5, cy: 0.5, zoom: 1 });
    expect(first.achievedAt).toBe("2026-05-01T00:00:00.000Z");
    const p1 = await getPhoto(first.photoId!);
    expect(p1?.boardId).toBe(board.id);
    expect(await p1!.blob.text()).toBe("full-1");

    board = await attachPhoto(board, 1, 1, imported("2"), "2026-06-01T00:00:00.000Z");
    const second = board.cells[0];
    expect(second.photoId).not.toBe(first.photoId);
    expect(second.achievedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(await getPhoto(first.photoId!)).toBeUndefined();

    board = await detachPhoto(board, 1, 1);
    const cleared = (await getBoard(board.id))!.cells[0];
    expect(cleared.photoId).toBeUndefined();
    expect(cleared.crop).toBeUndefined();
    expect(cleared.achievedAt).toBeUndefined();
    expect(await getPhoto(second.photoId!)).toBeUndefined();
    expect(await (await getDb()).count("photos")).toBe(0);
  });

  it("refuses to attach a photo to an empty cell", async () => {
    const board = await createBoard("A", { cols: 3, rows: 3 });
    await expect(attachPhoto(board, 0, 0, imported("x"))).rejects.toThrow();
  });
});
