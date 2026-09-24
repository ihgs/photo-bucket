import { beforeEach, describe, expect, it } from "vitest";
import { parseBackup } from "../../src/backup/importBackup";
import { createZip } from "../../src/backup/zip";
import { resetDbForTests, getDb } from "../../src/storage/db";

const PIXEL = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
const text = (s: string) => new TextEncoder().encode(s);

/** A .pbz with the given backup.json and photo entries. */
const pbz = (
  manifest: unknown,
  photos: Record<string, Uint8Array<ArrayBuffer>> = { "photos/p1.jpg": PIXEL },
) =>
  createZip([
    {
      name: "backup.json",
      data: text(typeof manifest === "string" ? manifest : JSON.stringify(manifest)),
    },
    ...Object.entries(photos).map(([name, data]) => ({ name, data })),
  ]);

const valid = () => ({
  format: "photo-bucket-backup",
  formatVersion: 1,
  exportedAt: "2026-09-23T00:00:00.000Z",
  boards: [
    {
      id: "b1",
      title: "旅",
      size: { cols: 3, rows: 4 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      cells: [
        {
          id: "c1",
          row: 0,
          col: 0,
          title: "海",
          category: "go",
          memo: "",
          photoId: "p1",
          crop: { cx: 0.5, cy: 0.5, zoom: 1 },
          achievedAt: "2026-02-01T00:00:00.000Z",
          futureField: "ignored",
        },
      ],
    },
  ],
  photos: [
    { id: "p1", boardId: "b1", width: 10, height: 10, type: "image/jpeg", path: "photos/p1.jpg" },
  ],
  unknownTopLevel: true,
});

const expectError = async (file: Blob | Promise<Blob>, message: string) => {
  await expect(parseBackup(await file)).rejects.toThrow(message);
  expect(await (await getDb()).count("boards")).toBe(0);
  expect(await (await getDb()).count("photos")).toBe(0);
};

beforeEach(async () => {
  await resetDbForTests();
});

describe("parseBackup validation (contracts/backup-format.md)", () => {
  it("accepts a valid file and ignores unknown fields", async () => {
    const parsed = await parseBackup(await pbz(valid()));
    expect(parsed.boards[0].id).toBe("b1");
    expect(parsed.boards[0].cells[0]).not.toHaveProperty("futureField");
    expect(parsed.photos[0].bytes.byteLength).toBe(4);
  });

  it("rejects a file that is not a ZIP", async () => {
    await expectError(
      new Blob([JSON.stringify(valid())]),
      "バックアップファイルを読み込めませんでした（ファイルが壊れている可能性があります）",
    );
  });

  it("rejects a backup.json that is not JSON", async () => {
    await expectError(
      pbz("{not json"),
      "バックアップファイルを読み込めませんでした（ファイルが壊れている可能性があります）",
    );
  });

  it("rejects files of another format", async () => {
    await expectError(
      pbz({ ...valid(), format: "other" }),
      "このアプリのバックアップファイルではありません",
    );
  });

  it("rejects newer format versions", async () => {
    await expectError(
      pbz({ ...valid(), formatVersion: 2 }),
      "新しいバージョンのアプリで作られたファイルです。アプリを更新してください",
    );
  });

  it("rejects unsupported grid sizes", async () => {
    const v = valid();
    v.boards[0].size = { cols: 6, rows: 6 };
    await expectError(pbz(v), "ファイルの内容に誤りがあります");
  });

  it("rejects missing photos", async () => {
    const v = valid();
    v.photos = [];
    await expectError(pbz(v), "写真のデータが欠けています");
  });

  it("rejects photos that are not image data", async () => {
    const v = valid();
    v.photos[0].type = "text/plain";
    await expectError(pbz(v), "写真のデータが欠けています");
  });

  it("rejects a ZIP without backup.json", async () => {
    await expectError(
      createZip([{ name: "other.json", data: text("{}") }]),
      "このアプリのバックアップファイルではありません",
    );
  });

  it("rejects a missing photo entry", async () => {
    await expectError(pbz(valid(), {}), "写真のデータが欠けています");
  });
});
