import { beforeEach, describe, expect, it } from "vitest";
import { upsertCell } from "../../src/domain/grid";
import { exportBackup } from "../../src/backup/exportBackup";
import { applyBackup, detectConflicts, parseBackup } from "../../src/backup/importBackup";
import { createBoard, getBoard, listBoards, saveBoard } from "../../src/storage/boards";
import { getDb, resetDbForTests } from "../../src/storage/db";
import { attachPhoto, getPhoto, getPhotosOfBoard } from "../../src/storage/photos";
import { getPreferences } from "../../src/storage/preferences";

const bytes = (n: number, seed: number) =>
  Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 256);
const imported = (seed: number) => ({
  blob: new Blob([bytes(3000, seed)], { type: "image/jpeg" }),
  thumbBlob: new Blob([bytes(300, seed)], { type: "image/jpeg" }),
  width: 1600,
  height: 1200,
});
/** Test double: happy-dom cannot decode images. */
const makeThumb = async (b: Blob) =>
  new Blob([new Uint8Array(await b.arrayBuffer()).slice(0, 10)], { type: "image/jpeg" });

const seed = async () => {
  let a = await createBoard("縦長", { cols: 3, rows: 4 });
  a = await saveBoard(upsertCell(a, 0, 0, { title: "登山", category: "go", memo: "朝5時" }));
  a = await saveBoard(upsertCell(a, 3, 2, { title: "パフェ", category: "eat" }));
  a = await attachPhoto(a, 0, 0, imported(1), "2026-05-01T00:00:00.000Z");
  a = (await getBoard(a.id))!;
  a = await saveBoard({
    ...a,
    cells: a.cells.map((c) => (c.photoId ? { ...c, crop: { cx: 0.4, cy: 0.6, zoom: 1.5 } } : c)),
  });
  let b = await createBoard("正方形", { cols: 5, rows: 5 });
  b = await saveBoard(upsertCell(b, 4, 4, { title: "オーロラ", category: "want" }));
  b = await attachPhoto(b, 4, 4, imported(2), "2026-06-01T00:00:00.000Z");
  return [(await getBoard(a.id))!, (await getBoard(b.id))!];
};

beforeEach(async () => {
  await resetDbForTests();
});

describe("backup round trip (SC-007)", () => {
  it("restores boards, cells, crop, achievedAt and identical photo bytes", async () => {
    const [a, b] = await seed();
    const photosBefore = [...(await getPhotosOfBoard(a.id)), ...(await getPhotosOfBoard(b.id))];
    const bytesBefore = await Promise.all(
      photosBefore.map(async (p) => [p.id, new Uint8Array(await p.blob.arrayBuffer())] as const),
    );

    const { blob, fileName } = await exportBackup();
    expect(fileName).toMatch(/^photo-bucket-\d{8}-\d{4}\.photobucket\.json$/);
    expect((await getPreferences()).lastBackupAt).not.toBeNull();
    const text = await blob.text();

    await resetDbForTests();
    expect(await listBoards()).toEqual([]);

    const parsed = await parseBackup(text);
    expect(detectConflicts(parsed, [])).toEqual([]);
    await applyBackup(parsed, {}, { makeThumb });

    const restoredA = await getBoard(a.id);
    const restoredB = await getBoard(b.id);
    expect(restoredA).toEqual(a);
    expect(restoredB).toEqual(b);
    for (const [id, before] of bytesBefore) {
      const p = await getPhoto(id);
      expect(new Uint8Array(await p!.blob.arrayBuffer())).toEqual(before);
      expect(p!.thumbBlob.size).toBe(10); // regenerated
    }
  });

  it("exports a single board", async () => {
    const [a] = await seed();
    const { blob } = await exportBackup([a.id]);
    const json = JSON.parse(await blob.text());
    expect(json.boards.map((x: { id: string }) => x.id)).toEqual([a.id]);
    expect(json.photos).toHaveLength(1);
  });

  it("overwrites or copies boards whose id already exists", async () => {
    const [a] = await seed();
    const text = await (await exportBackup([a.id])).blob.text();
    const parsed = await parseBackup(text);
    const existing = (await listBoards()).map((x) => x.id);
    expect(detectConflicts(parsed, existing).map((x) => x.id)).toEqual([a.id]);

    await applyBackup(parsed, { [a.id]: "copy" }, { makeThumb });
    const all = await listBoards();
    expect(all).toHaveLength(3);
    const copy = all.find((x) => x.title === "縦長（復元）")!;
    expect(copy.id).not.toBe(a.id);
    expect(copy.cells.map((c) => c.title).sort()).toEqual(["パフェ", "登山"]);
    const copyPhotoId = copy.cells.find((c) => c.photoId)!.photoId!;
    expect(copyPhotoId).not.toBe(a.cells.find((c) => c.photoId)!.photoId);
    expect((await getPhoto(copyPhotoId))?.boardId).toBe(copy.id);

    // overwrite: the edited original is replaced by the backup contents
    await saveBoard({ ...a, title: "編集済み", cells: [] });
    await applyBackup(parsed, { [a.id]: "overwrite" }, { makeThumb });
    expect((await getBoard(a.id))?.title).toBe("縦長");
    expect(await (await getDb()).count("photos")).toBe(3);
  });
});
