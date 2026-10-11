# Data Model: 外部のテンプレートを取り込む

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-06

保存するデータ（IndexedDB のスキーマ・バックアップ形式）は変えない。ここに書くものはすべてメモリ上だけのもの。

## テンプレートの形式（外部の JSON）

書き方の決まりは [contracts/template-format.md](./contracts/template-format.md)。読み取ると次の「取り込んだテンプレート」になる。

## 取り込んだテンプレート（`BoardTemplate` を流用）

`src/domain/templates.ts` の既存の型をそのまま使う。

| 項目 | 型 | 取り込み時の値 |
|---|---|---|
| `id` | string | `"imported"`（固定。アプリのテンプレートの id とは重ならない） |
| `name` | string | 形式の `name`（前後の空白を除く、1〜20 文字） |
| `title` | string | 形式の `title`（前後の空白を除く、1〜40 文字。`{年}` を含められる） |
| `description` | string | 形式の `description`（0〜60 文字。省略時は空） |
| `size` | `GridSize` | `{ cols: rows[0].length, rows: rows.length }`。`GRID_SIZES` の 5 種類のどれか |
| `items` | `TemplateItem[]` | `rows[r][c]` が `null` でないマスごとに `{ row: r, col: c, title, category }`（0 始まり）。1 件以上 |

- 新しく `imported?: true` を足し、`TemplatePreview` で「取り込んだテンプレート」と表示するのに使う
- 既存の決まり「アプリのテンプレートはすべてのマスが埋まっている」は、アプリのテンプレートの単体テストだけで確かめる。
  型としては空きマスを許す（今の型もそうなっている）

## 取り込みの結果（`parseTemplate` の戻り値）

```ts
type ParseResult =
  | { ok: true; template: BoardTemplate }
  | { ok: false; errors: string[] }; // 表示する日本語の文。最大 5 件 + 「ほか n 件」
```

## 読み込みの結果（`fetchTemplateText` の戻り値）

```ts
type FetchResult =
  | { ok: true; text: string }
  | { ok: false; reason: "invalid-url" | "offline" | "blocked" | "not-found" | "http-error" | "timeout" | "too-large" | "html" | "aborted"; status?: number };
```

`reason` から表示する文は [contracts/import-ui.md](./contracts/import-ui.md) の表に従う。`aborted`（ユーザーがやめた）は何も表示しない。

## 「新しいボード」の画面の状態（`NewBoard`）

| 状態 | 変更 |
|---|---|
| `templateId: string \| null` | → `template: BoardTemplate \| null` に変える（アプリのテンプレートも取り込んだテンプレートも入る） |
| `manual` | 変更なし（テンプレートを選ぶ前のタイトル・サイズ） |

状態の移り変わり:

```text
テンプレートなし ──(アプリのテンプレートを選ぶ / 取り込む)──▶ テンプレートあり
テンプレートあり ──(別のテンプレートを選ぶ / 取り込む)──▶ テンプレートあり（manual は最初の値のまま）
テンプレートあり ──(「やめる」)──▶ テンプレートなし（manual のタイトル・サイズに戻す）
テンプレートあり ──(「ボードを作る」)──▶ ボードの画面（取り込んだテンプレートは捨てる）
```

画面を離れると状態はすべて捨てる（FR-010）。

## 既存のボード

変更なし。取り込んだテンプレートから作るボードも `cellsFromTemplate` で作る普通のボード（FR-011）。
