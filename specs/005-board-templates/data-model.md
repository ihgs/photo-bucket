# Data Model: テンプレートからボードを作る

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md) | **Date**: 2026-10-04

保存するデータは変えない。DB スキーマ・`Board`・`Cell`・バックアップ形式はそのまま（憲章 VI）。テンプレートはアプリのコードに含まれる定数。

## BoardTemplate（アプリ内の定数、保存しない）

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | 識別子（`domestic-travel` など）。テンプレートどうしで重複しない |
| `name` | string | 一覧に出す名前（例: 一年の目標） |
| `title` | string | ボードのタイトルの初期値。`{年}` を含められる（例: `{年}年の目標`） |
| `description` | string | 一覧に出す説明 1 行 |
| `size` | `GridSize` | 5 種類のどれか（001 data-model.md） |
| `items` | `TemplateItem[]` | 長さは `size.cols × size.rows` |

## TemplateItem

| フィールド | 型 | 説明 / ルール |
|---|---|---|
| `row` | number | 0 から。`row < size.rows` |
| `col` | number | 0 から。`col < size.cols` |
| `title` | string | 1〜60 文字（`CELL_TITLE_MAX`）。数字（半角・全角）を含まない（回数や期間を入れない） |
| `category` | `Category` | `want`（やりたい）・`go`（行きたい）・`eat`（食べたい）・`other`（その他） |

- 同じテンプレートの中で `(row, col)` は重複しない。

## 定義するテンプレート（spec.md FR-002・FR-003 のとおり）

| id | name | title | size | 項目数 |
|---|---|---|---|---|
| `domestic-travel` | 国内旅行 | 国内旅行 | 3×4 | 12 |
| `year-goals` | 一年の目標 | {年}年の目標 | 5×5 | 25 |
| `best-food` | 今年のベストごはん | {年}年のベストごはん | 3×3 | 9 |
| `seasons` | 季節の楽しみ | 季節の楽しみ | 4×4 | 16 |

## テンプレートからできるボード

- `cellsFromTemplate(template, newId)` → 各項目を `Cell { id: newId(), row, col, title, category, memo: "" }` にする。`photoId`・`crop`・`achievedAt` はなし。
- ボードは `createBoard(resolvedTitle, template.size, cells)` で 1 回で保存する。どのテンプレートから作ったかは記録しない（FR-007）。

## 「新しいボード」の画面の状態（保存しない）

| 状態 | 内容 |
|---|---|
| `templateId` | `null`（使わない）またはテンプレートの id |
| `title`・`size` | 入力中のタイトル・サイズ |
| `manual` | テンプレートを選ぶ直前の `{ title, size }`。「使わない」に戻したら復元する |
