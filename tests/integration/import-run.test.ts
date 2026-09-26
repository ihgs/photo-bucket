import { beforeEach, describe, expect, it, vi } from "vitest";
import { upsertCell } from "../../src/domain/grid";
import { exportBackup } from "../../src/backup/exportBackup";
import { getExportLog, recordExport } from "../../src/backup/exportLog";
import { inspectBackup } from "../../src/backup/importBackup";
import { planImport, runImportPlan } from "../../src/backup/importPlan";
import {
  createBoard,
  deleteBoard,
  getBoard,
  listBoards,
  saveBoard,
} from "../../src/storage/boards";
import { getDb, resetDbForTests } from "../../src/storage/db";
import { attachPhoto } from "../../src/storage/photos";

const bytes = (n: number, seed: number) =>
  Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 256);
const imported = (seed: number) => ({
  blob: new Blob([bytes(3000, seed)], { type: "image/jpeg" }),
  thumbBlob: new Blob([bytes(300, seed)], { type: "image/jpeg" }),
  width: 1600,
  height: 1200,
});
/** Test double: happy-dom cannot decode images. A photo whose first byte is 0 is "broken". */
const makeThumb = async (b: Blob) => {
  const data = new Uint8Array(await b.arrayBuffer());
  if (data[0] === 0) throw new Error("cannot decode");
  return new Blob([data.slice(0, 10)], { type: "image/jpeg" });
};

/** Three boards with one photo each; the photo of the second one starts with byte 0 (seed 0). */
const seedThree = async () => {
  const boards = [];
  for (const [title, seed] of [
    ["一", 1],
    ["二", 0],
    ["三", 2],
  ] as const) {
    let b = await createBoard(title, { cols: 3, rows: 3 });
    b = await saveBoard(upsertCell(b, 0, 0, { title: `${title}の項目`, category: "want" }));
    b = await attachPhoto(b, 0, 0, imported(seed), "2026-05-01T00:00:00.000Z");
    boards.push((await getBoard(b.id))!);
  }
  return boards;
};

const counts = async () => {
  const db = await getDb();
  return { boards: await db.count("boards"), photos: await db.count("photos") };
};

beforeEach(async () => {
  await resetDbForTests();
});

describe("inspectBackup", () => {
  it("reads boards and photo entries without reading photo bytes", async () => {
    const boards = await seedThree();
    const file = (await exportBackup(boards.map((b) => b.id))).blob;
    const source = await inspectBackup(file);
    expect(source.boards.map((b) => b.title)).toEqual(["一", "二", "三"]);
    const photoId = boards[0].cells[0].photoId!;
    expect(source.photos.get(photoId)).toMatchObject({
      boardId: boards[0].id,
      type: "image/jpeg",
      path: `photos/${photoId}.jpg`,
    });
    expect(source.photos.get(photoId)).not.toHaveProperty("bytes");
  });

  it("rejects a broken file without writing anything", async () => {
    await expect(inspectBackup(new Blob(["not a zip"]))).rejects.toThrow(
      "バックアップファイルを読み込めませんでした（ファイルが壊れている可能性があります）",
    );
    expect(await counts()).toEqual({ boards: 0, photos: 0 });
  });
});

describe("runImportPlan (add)", () => {
  it("imports one board at a time, reporting progress", async () => {
    const boards = await seedThree();
    const file = (await exportBackup([boards[0].id, boards[2].id])).blob;
    await resetDbForTests();

    const plan = planImport([await inspectBackup(file)], [], "add", "skip");
    const progress: [number, number, string | undefined][] = [];
    const outcome = await runImportPlan(plan, (p) => progress.push([p.done, p.total, p.current]), {
      makeThumb,
    });
    expect(progress).toEqual([
      [0, 2, "一"],
      [1, 2, "三"],
      [2, 2, undefined],
    ]);
    expect(outcome.results.map((r) => r.status)).toEqual(["added", "added"]);
    expect(await getBoard(boards[0].id)).toEqual(boards[0]);
    expect(await getBoard(boards[2].id)).toEqual(boards[2]);
  });

  it("skips a board whose photo cannot be read and keeps going", async () => {
    const boards = await seedThree();
    const file = (await exportBackup(boards.map((b) => b.id))).blob;
    await resetDbForTests();

    const plan = planImport([await inspectBackup(file)], [], "add", "skip");
    const outcome = await runImportPlan(plan, undefined, { makeThumb });
    expect(outcome.results).toEqual([
      { title: "一", status: "added" },
      { title: "二", status: "failed", reason: "写真のデータが欠けています" },
      { title: "三", status: "added" },
    ]);
    expect(await getBoard(boards[1].id)).toBeUndefined();
    expect(await counts()).toEqual({ boards: 2, photos: 2 });
  });

  it("skips boards that already exist when asked to", async () => {
    const [a] = await seedThree();
    const file = (await exportBackup([a.id])).blob;
    await saveBoard({ ...a, title: "編集済み" });
    const plan = planImport([await inspectBackup(file)], [a.id], "add", "skip");
    const outcome = await runImportPlan(plan, undefined, { makeThumb });
    expect(outcome.results).toEqual([{ title: "一", status: "skipped" }]);
    expect((await getBoard(a.id))?.title).toBe("編集済み");
  });

  it("forgets the export record of boards it writes", async () => {
    const [a, , c] = await seedThree();
    const file = (await exportBackup([a.id])).blob;
    await deleteBoard(a.id);
    await recordExport([a.id, c.id], "2026-09-01T00:00:00.000Z");
    const plan = planImport([await inspectBackup(file)], [], "add", "skip");
    await runImportPlan(plan, undefined, { makeThumb });
    expect(await getExportLog()).toEqual({ [c.id]: "2026-09-01T00:00:00.000Z" });
    expect((await listBoards()).map((b) => b.id)).toContain(a.id);
  });
});

describe("runImportPlan (replace)", () => {
  it("makes the device's boards exactly the backup's, deleting the rest last", async () => {
    const [a, , c] = await seedThree();
    const file = (await exportBackup([a.id, c.id])).blob;
    const extra = await createBoard("あとで作った", { cols: 3, rows: 3 });
    await recordExport([extra.id], "2026-09-01T00:00:00.000Z");
    await saveBoard({ ...a, title: "編集済み" });

    const existing = (await listBoards()).map((b) => b.id);
    const plan = planImport([await inspectBackup(file)], existing, "replace");
    const outcome = await runImportPlan(plan, undefined, { makeThumb });
    expect(outcome.keptExisting).toBe(false);
    expect(outcome.results.map((r) => r.status)).toEqual(["overwritten", "overwritten"]);
    expect((await listBoards()).map((b) => b.id).sort()).toEqual([a.id, c.id].sort());
    expect(await getBoard(a.id)).toEqual(a);
    expect(await counts()).toEqual({ boards: 2, photos: 2 });
    expect(await getExportLog()).toEqual({});
  });

  it("keeps every original board when a board of the backup fails", async () => {
    const boards = await seedThree();
    const file = (await exportBackup([boards[1].id])).blob; // the broken one
    const other = await createBoard("残る", { cols: 3, rows: 3 });
    await deleteBoard(boards[1].id);

    const existing = (await listBoards()).map((b) => b.id);
    const plan = planImport([await inspectBackup(file)], existing, "replace");
    const outcome = await runImportPlan(plan, undefined, { makeThumb });
    expect(outcome.keptExisting).toBe(true);
    expect((await listBoards()).map((b) => b.id).sort()).toEqual(
      [boards[0].id, boards[2].id, other.id].sort(),
    );
  });

  it("stops on a full storage and keeps every original board", async () => {
    const [a, b] = await seedThree();
    const file = (await exportBackup([a.id, b.id])).blob;
    const existing = (await listBoards()).map((x) => x.id);
    const plan = planImport([await inspectBackup(file)], [...existing, "gone"], "replace");
    // The first photo write hits the quota; nothing after it is tried.
    const original = IDBObjectStore.prototype.put;
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "photos") throw new DOMException("full", "QuotaExceededError");
      return original.apply(this, args);
    });
    const outcome = await runImportPlan(plan, undefined, { makeThumb });
    const photoPuts = put.mock.contexts.filter((c) => (c as IDBObjectStore).name === "photos");
    put.mockRestore();
    expect(photoPuts).toHaveLength(1);
    expect(outcome.results.map((r) => [r.status, r.reason])).toEqual([
      ["failed", "端末の保存容量が足りません"],
      ["failed", "端末の保存容量が足りません"],
    ]);
    expect(outcome.keptExisting).toBe(true);
    expect((await listBoards()).map((x) => x.id).sort()).toEqual(existing.sort());
  });

  it("applies one choice to every existing board when adding", async () => {
    const [a, , c] = await seedThree();
    const file = (await exportBackup([a.id, c.id])).blob;
    const plan = planImport([await inspectBackup(file)], [a.id, c.id], "add", "copy");
    const outcome = await runImportPlan(plan, undefined, { makeThumb });
    expect(outcome.results.map((r) => r.status)).toEqual(["copied", "copied"]);
    expect((await listBoards()).map((b) => b.title).sort()).toEqual(
      ["一", "一（復元）", "三", "三（復元）", "二"].sort(),
    );
  });
});
