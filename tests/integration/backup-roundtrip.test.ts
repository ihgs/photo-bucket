import { beforeEach, describe, expect, it, vi } from "vitest";
import { upsertCell } from "../../src/domain/grid";
import { estimateBackupSize, exportBackup } from "../../src/backup/exportBackup";
import { getExportLog } from "../../src/backup/exportLog";
import * as shareImage from "../../src/media/shareImage";
import { runExport } from "../../src/ui/backupActions";
import { readZip } from "../../src/backup/zip";
import { inspectBackup } from "../../src/backup/importBackup";
import { planImport, runImportPlan, type ConflictAction } from "../../src/backup/importPlan";
import {
  createBoard,
  deleteBoard,
  getBoard,
  listBoards,
  saveBoard,
} from "../../src/storage/boards";
import { getDb, resetDbForTests } from "../../src/storage/db";
import { attachPhoto, getPhoto, getPhotosOfBoard } from "../../src/storage/photos";

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
    cells: a.cells.map((c) =>
      c.photoId ? { ...c, crop: { cx: 0.4, cy: 0.6, zoom: 1.5, rotation: 90 } } : c,
    ),
  });
  let b = await createBoard("正方形", { cols: 5, rows: 5 });
  b = await saveBoard(upsertCell(b, 4, 4, { title: "オーロラ", category: "want" }));
  b = await attachPhoto(b, 4, 4, imported(2), "2026-06-01T00:00:00.000Z");
  return [(await getBoard(a.id))!, (await getBoard(b.id))!];
};

const restore = async (
  file: Blob,
  mode: "add" | "replace",
  onConflict: ConflictAction = "skip",
) => {
  const existing = (await listBoards()).map((b) => b.id);
  const plan = planImport([await inspectBackup(file)], existing, mode, onConflict);
  return runImportPlan(plan, undefined, { makeThumb });
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

    const { blob, fileName } = await exportBackup([a.id, b.id]);
    expect(fileName).toMatch(/^photo-bucket-\d{8}-\d{4}\.pbz$/);
    expect(blob.type).toBe("application/zip");
    await resetDbForTests();
    expect(await listBoards()).toEqual([]);

    const outcome = await restore(blob, "add");
    expect(outcome.results.map((r) => r.status)).toEqual(["added", "added"]);

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
    const zip = await readZip(blob);
    expect(zip.names()).toHaveLength(2);
    const json = JSON.parse(new TextDecoder().decode(await zip.read("backup.json")));
    expect(json.boards.map((x: { id: string }) => x.id)).toEqual([a.id]);
    expect(json.photos).toHaveLength(1);
  });

  it("overwrites or copies boards whose id already exists", async () => {
    const [a] = await seed();
    const file = (await exportBackup([a.id])).blob;
    await restore(file, "add", "copy");
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
    await restore(file, "add", "overwrite");
    expect((await getBoard(a.id))?.title).toBe("縦長");
    expect(await (await getDb()).count("photos")).toBe(3);
  });

  it("restores the exported state with replace (SC-005)", async () => {
    const [a, b] = await seed();
    const file = (await exportBackup([a.id, b.id])).blob;
    // after the backup: delete one, add one, edit one
    await deleteBoard(b.id);
    await createBoard("あとで作った", { cols: 3, rows: 3 });
    await saveBoard({ ...a, title: "編集済み", cells: [] });

    const outcome = await restore(file, "replace");
    expect(outcome.keptExisting).toBe(false);
    const after = await listBoards();
    expect(after.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
    expect(await getBoard(a.id)).toEqual(a);
    expect(await getBoard(b.id)).toEqual(b);
    expect(await (await getDb()).count("photos")).toBe(2);
  });
});

describe("export size and record (FR-012, FR-019, SC-007)", () => {
  it("estimates the file size within 10% without reading photos", async () => {
    const [a, b] = await seed();
    const est = await estimateBackupSize([a.id, b.id]);
    const { blob } = await exportBackup([a.id, b.id]);
    expect(Math.abs(est.total - blob.size) / blob.size).toBeLessThan(0.1);
    expect(est.perBoard[a.id]).toBeGreaterThan(3000);
    expect(est.perBoard[a.id] + est.perBoard[b.id]).toBeLessThanOrEqual(est.total);
  });

  it("records the export only when the file was handed over", async () => {
    const [a, b] = await seed();
    const share = vi.spyOn(shareImage, "shareOrDownload");
    share.mockResolvedValueOnce("cancelled");
    await runExport([a.id, b.id]);
    expect(await getExportLog()).toEqual({});
    share.mockResolvedValueOnce("downloaded");
    await runExport([a.id]);
    expect(Object.keys(await getExportLog())).toEqual([a.id]);
    share.mockRestore();
  });

  it("stops when a photo of a board is missing", async () => {
    const [a] = await seed();
    await (await getDb()).delete("photos", a.cells.find((c) => c.photoId)!.photoId!);
    await expect(exportBackup([a.id])).rejects.toThrow(
      "『縦長』の写真を読み込めなかったため、書き出しを中止しました",
    );
  });
});
