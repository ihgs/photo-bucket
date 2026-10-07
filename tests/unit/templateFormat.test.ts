import { describe, expect, it } from "vitest";
import { TEMPLATES, type BoardTemplate } from "../../src/domain/templates";
import { parseTemplate } from "../../src/domain/templateFormat";
import { categoryInfo } from "../../src/domain/types";

/** The example in contracts/template-format.md. */
const EXAMPLE = {
  format: "bucket-grid-template",
  version: 1,
  name: "季節の楽しみ",
  title: "{年}年 季節の楽しみ",
  description: "春夏秋冬、季節ごとの楽しみを写真に残そう",
  category: "やりたい",
  rows: [
    ["お花見をする", { title: "いちご狩りに行く", category: "行きたい" }, "潮干狩りをする"],
    ["海で泳ぐ", { title: "かき氷を食べる", category: "食べたい" }, null],
    ["紅葉狩りに行く", "お月見をする", { title: "栗ごはんを食べる", category: "eat" }],
  ],
};

type Json = Record<string, unknown>;
const parse = (value: Json) => parseTemplate(JSON.stringify(value));
const ok = (value: Json) => {
  const r = parse(value);
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.template;
};
const errors = (value: Json | string) => {
  const r = typeof value === "string" ? parseTemplate(value) : parse(value);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
};
const without = (value: Json, ...keys: string[]): Json =>
  Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)));
const withCell = (row: number, col: number, cell: unknown): Json => ({
  ...EXAMPLE,
  rows: EXAMPLE.rows.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? cell : c))),
});

describe("parseTemplate (contracts/template-format.md)", () => {
  it("reads the example", () => {
    const t = ok(EXAMPLE);
    expect(t).toMatchObject({
      id: "imported",
      imported: true,
      name: "季節の楽しみ",
      title: "{年}年 季節の楽しみ",
      description: "春夏秋冬、季節ごとの楽しみを写真に残そう",
      size: { cols: 3, rows: 3 },
    });
    expect(t.items).toHaveLength(8);
    expect(t.items.find((i) => i.row === 1 && i.col === 2)).toBeUndefined();
    const category = (title: string) => t.items.find((i) => i.title === title)?.category;
    expect(category("いちご狩りに行く")).toBe("go");
    expect(category("かき氷を食べる")).toBe("eat");
    expect(category("栗ごはんを食べる")).toBe("eat");
    expect(category("お花見をする")).toBe("want");
    expect(category("お月見をする")).toBe("want");
  });

  it("defaults the category to want and the description to empty", () => {
    const t = ok(without(EXAMPLE, "category", "description"));
    expect(t.description).toBe("");
    expect(t.items.find((i) => i.title === "海で泳ぐ")?.category).toBe("want");
    expect(t.items.find((i) => i.title === "いちご狩りに行く")?.category).toBe("go");
  });

  it("counts characters after trimming, emoji as one", () => {
    const t = ok({
      ...EXAMPLE,
      name: ` ${"名".repeat(20)} `,
      title: "題".repeat(40),
      description: "説".repeat(60),
      rows: withCell(0, 0, `${"🍓".repeat(60)}  `).rows,
    });
    expect(t.name).toBe("名".repeat(20));
    expect(t.items.find((i) => i.row === 0 && i.col === 0)?.title).toBe("🍓".repeat(60));

    expect(errors({ ...EXAMPLE, name: "名".repeat(21) })).toEqual([
      "名前は20文字以内にしてください",
    ]);
    expect(errors({ ...EXAMPLE, title: "題".repeat(41) })).toEqual([
      "タイトルは40文字以内にしてください",
    ]);
    expect(errors({ ...EXAMPLE, description: "説".repeat(61) })).toEqual([
      "説明は60文字以内にしてください",
    ]);
    expect(errors(withCell(0, 0, "あ".repeat(61)))).toEqual([
      "1 行目 1 列目: タイトルは60文字以内にしてください",
    ]);
  });

  it("explains each mistake", () => {
    expect(errors(`{"rows":"${"x".repeat(102_400)}"}`)).toEqual(["大きすぎます（100 KB まで）"]);
    // Counted in UTF-8 bytes: 34,134 three-byte characters exceed 100 KB.
    expect(errors(JSON.stringify({ ...EXAMPLE, description: "あ".repeat(34_134) }))).toEqual([
      "大きすぎます（100 KB まで）",
    ]);
    expect(errors("{ not json")).toEqual([
      "テンプレートの形式ではありません（JSON として読めません）",
    ]);
    expect(errors("[]")).toEqual([
      'テンプレートの形式ではありません（"format" が "bucket-grid-template" ではありません）',
    ]);
    expect(errors({ ...EXAMPLE, format: "photo-bucket-backup" })).toEqual([
      'テンプレートの形式ではありません（"format" が "bucket-grid-template" ではありません）',
    ]);
    expect(errors({ ...EXAMPLE, version: 2 })).toEqual([
      "新しい形式のため取り込めません。アプリを更新してください",
    ]);
    expect(errors(without(EXAMPLE, "version"))).toEqual(['"version" は 1 にしてください']);
    expect(errors({ ...EXAMPLE, version: 0.5 })).toEqual(['"version" は 1 にしてください']);
    expect(errors({ ...EXAMPLE, name: "  " })).toEqual(["名前を入れてください"]);
    expect(errors({ ...EXAMPLE, title: 3 })).toEqual(["タイトルを入れてください"]);
    expect(errors({ ...EXAMPLE, category: "food" })).toEqual([
      '"category" は want・go・eat・other（やりたい・行きたい・食べたい・その他）のどれかにしてください',
    ]);
    expect(errors(without(EXAMPLE, "rows"))).toEqual(['"rows" にマス目を書いてください']);
    expect(errors({ ...EXAMPLE, rows: [] })).toEqual(['"rows" にマス目を書いてください']);
    expect(
      errors({
        ...EXAMPLE,
        rows: [
          ["a", "b", "c"],
          ["a", "b", "c"],
          ["a", "b"],
        ],
      }),
    ).toEqual(["1 行のマスの数がそろっていません（3 行目）"]);
    expect(
      errors({
        ...EXAMPLE,
        rows: [
          ["a", "b"],
          ["c", "d"],
        ],
      }),
    ).toEqual(["マス目のサイズ 2×2 は使えません（3×3・4×4・5×5・3×4・4×3）"]);
    const square = (n: number, rows = n) => Array.from({ length: rows }, () => Array(n).fill("a"));
    expect(errors({ ...EXAMPLE, rows: square(6) })).toEqual([
      "マス目のサイズ 6×6 は使えません（3×3・4×4・5×5・3×4・4×3）",
    ]);
    expect(errors({ ...EXAMPLE, rows: square(4, 5) })).toEqual([
      "マス目のサイズ 4×5 は使えません（3×3・4×4・5×5・3×4・4×3）",
    ]);
    expect(errors(withCell(1, 0, " "))).toEqual(["2 行目 1 列目: タイトルを入れてください"]);
    expect(errors(withCell(2, 1, { title: "x", category: "food" }))).toEqual([
      "3 行目 2 列目: カテゴリは want・go・eat・other（やりたい・行きたい・食べたい・その他）のどれかにしてください",
    ]);
    expect(errors(withCell(0, 2, 42))).toEqual([
      '1 行目 3 列目: 文字列か {"title", "category"} か null にしてください',
    ]);
    expect(errors({ ...EXAMPLE, rows: square(3).map((r) => r.map(() => null)) })).toEqual([
      "項目が 1 つもありません",
    ]);
  });

  it("shows five cell mistakes and counts the rest", () => {
    const rows = Array.from({ length: 3 }, () => Array(3).fill(""));
    rows[2] = ["a", "b", ""];
    const result = errors({ ...EXAMPLE, rows });
    expect(result).toEqual([
      "1 行目 1 列目: タイトルを入れてください",
      "1 行目 2 列目: タイトルを入れてください",
      "1 行目 3 列目: タイトルを入れてください",
      "2 行目 1 列目: タイトルを入れてください",
      "2 行目 2 列目: タイトルを入れてください",
      "ほか 2 件",
    ]);
  });

  it("ignores unknown fields", () => {
    expect(ok({ ...EXAMPLE, author: "someone" }).name).toBe("季節の楽しみ");
  });

  it("can express every built-in template", () => {
    const toFormat = (t: BoardTemplate) => ({
      format: "bucket-grid-template",
      version: 1,
      name: t.name,
      title: t.title,
      description: t.description,
      rows: Array.from({ length: t.size.rows }, (_, row) =>
        Array.from({ length: t.size.cols }, (_, col) => {
          const i = t.items.find((x) => x.row === row && x.col === col)!;
          return { title: i.title, category: categoryInfo(i.category).label };
        }),
      ),
    });
    const sorted = (t: BoardTemplate) =>
      [...t.items].sort((a, b) => a.row - b.row || a.col - b.col);
    for (const t of TEMPLATES) {
      const imported = ok(toFormat(t));
      expect(imported.size).toEqual(t.size);
      expect(sorted(imported)).toEqual(sorted(t));
    }
  });
});
