import { beforeEach, describe, expect, it } from "vitest";
import { parseBackup } from "../../src/backup/importBackup";
import { resetDbForTests, getDb } from "../../src/storage/db";

const PIXEL = "data:image/jpeg;base64,/9j/AA==";

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
  photos: [{ id: "p1", boardId: "b1", width: 10, height: 10, dataUrl: PIXEL }],
  unknownTopLevel: true,
});

const expectError = async (text: string, message: string) => {
  await expect(parseBackup(text)).rejects.toThrow(message);
  expect(await (await getDb()).count("boards")).toBe(0);
  expect(await (await getDb()).count("photos")).toBe(0);
};

beforeEach(async () => {
  await resetDbForTests();
});

describe("parseBackup validation (contracts/backup-format.md)", () => {
  it("accepts a valid file and ignores unknown fields", async () => {
    const parsed = await parseBackup(JSON.stringify(valid()));
    expect(parsed.boards[0].id).toBe("b1");
    expect(parsed.boards[0].cells[0]).not.toHaveProperty("futureField");
    expect(parsed.photos[0].bytes.byteLength).toBe(4);
  });

  it("rejects text that is not JSON", async () => {
    await expectError(
      "{not json",
      "バックアップファイルを読み込めませんでした（ファイルが壊れている可能性があります）",
    );
  });

  it("rejects files of another format", async () => {
    await expectError(
      JSON.stringify({ ...valid(), format: "other" }),
      "このアプリのバックアップファイルではありません",
    );
  });

  it("rejects newer format versions", async () => {
    await expectError(
      JSON.stringify({ ...valid(), formatVersion: 2 }),
      "新しいバージョンのアプリで作られたファイルです。アプリを更新してください",
    );
  });

  it("rejects unsupported grid sizes", async () => {
    const v = valid();
    v.boards[0].size = { cols: 6, rows: 6 };
    await expectError(JSON.stringify(v), "ファイルの内容に誤りがあります");
  });

  it("rejects missing photos", async () => {
    const v = valid();
    v.photos = [];
    await expectError(JSON.stringify(v), "写真のデータが欠けています");
  });

  it("rejects photos that are not image data", async () => {
    const v = valid();
    v.photos[0].dataUrl = "data:text/plain;base64,aGVsbG8=";
    await expectError(JSON.stringify(v), "写真のデータが欠けています");
  });
});
