# Data Model: 写真型バケットリスト

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md) | **Date**: 2026-09-23

すべてのデータは端末内の IndexedDB（データベース名 `photo-bucket`）に保存する。外部には送信しない（FR-018）。

## 型の概要

```text
Board 1 ──── * Cell 0..1 ──── 1 Photo
   (boards ストアに Cell を内包)     (photos ストア)
Preferences（meta ストア、1 件）
```

## Board（ボード）

1 つのバケットリスト。`boards` ストアに保存する（キー: `id`）。

| フィールド | 型 | 必須 | 説明 / 検証ルール |
|---|---|---|---|
| `id` | string (UUID v4) | ✓ | `crypto.randomUUID()` で生成。変更不可 |
| `title` | string | ✓ | 1〜40 文字（前後の空白は除去）。空なら「無題のボード」 |
| `size` | `GridSize` | ✓ | 下記の 5 種類のいずれか（FR-001） |
| `cells` | `Cell[]` | ✓ | 項目が入っているマスだけを持つ（空マスは要素なし）。`row < size.rows` かつ `col < size.cols`、同じ位置の重複なし |
| `createdAt` | string (ISO 8601) | ✓ | 作成日時 |
| `updatedAt` | string (ISO 8601) | ✓ | 最終更新日時。ボード一覧の並び順に使う（新しい順） |

### GridSize（マス目サイズ）

`{ cols, rows }` の組で、次の 5 種類だけを許可する（FR-001, clarifications）。

| 表示名 | cols | rows | ボードの縦横比 | 保存画像（px） |
|---|---|---|---|---|
| 3×3 | 3 | 3 | 1:1 | 2400 × 2400 |
| 4×4 | 4 | 4 | 1:1 | 2400 × 2400 |
| 5×5 | 5 | 5 | 1:1 | 2400 × 2400 |
| 3×4 | 3 | 4 | 縦 3:4 | 1800 × 2400 |
| 4×3 | 4 | 3 | 横 4:3 | 2400 × 1800 |

表示名は「横の列数×縦の行数」。マスは常に正方形。

**達成数**（FR-012）は保存せず、`cells` のうち `photoId` を持つ数と `cols × rows` から毎回計算する。

## Cell（マス・項目）

Board の `cells` 配列の要素。

| フィールド | 型 | 必須 | 説明 / 検証ルール |
|---|---|---|---|
| `id` | string (UUID v4) | ✓ | 位置を入れ替えても変わらない識別子 |
| `row` | integer | ✓ | 0 始まり。`0 ≤ row < size.rows` |
| `col` | integer | ✓ | 0 始まり。`0 ≤ col < size.cols` |
| `title` | string | ✓ | 1〜60 文字（FR-003） |
| `category` | `"want" \| "go" \| "eat" \| "other"` | ✓ | 表示名は「やりたい」「行きたい」「食べたい」「その他」（FR-004）。既定は `"want"` |
| `memo` | string | | 0〜500 文字 |
| `photoId` | string (UUID v4) | | 貼った写真の ID。あれば達成済み（FR-008） |
| `crop` | `Crop` | `photoId` があるとき ✓ | 写真の表示範囲（FR-009） |
| `achievedAt` | string (ISO 8601) | `photoId` があるとき ✓ | 写真を貼った日時（FR-011）。差し替えでは変えない |

### Crop（表示範囲）

| フィールド | 型 | 範囲 | 説明 |
|---|---|---|---|
| `cx` | number | 0〜1 | 写真内で表示の中心にする位置（横） |
| `cy` | number | 0〜1 | 写真内で表示の中心にする位置（縦） |
| `zoom` | number | 1〜4 | マスをちょうど覆う倍率を 1 とした拡大率 |
| `rotation` | 0 \| 90 \| 180 \| 270 | 任意 | 写真を時計回りに回す角度。省略時は 0（#8） |

`cx`, `cy` は回転後の写真に対する位置。表示範囲が写真の外にはみ出さないよう、`cx`, `cy` は `zoom` に応じて自動で制限する。初期値は `{ cx: 0.5, cy: 0.5, zoom: 1 }`。
回転は元の写真を変えず、表示と書き出しのときに適用する。

### 状態遷移

```text
 (空マス) ──項目を入力──▶ 未達成 ──写真を貼る──▶ 達成済み
    ▲                     │  ▲                    │  │
    └──────項目を削除─────┘  └────写真を外す──────┘  └─写真を差し替え─▶ 達成済み（achievedAt は維持）
    ▲                                                │
    └──────────────────項目を削除（写真も削除）───────┘
```

- 写真を外す: `photoId`・`crop`・`achievedAt` を消し、Photo も削除する（FR-010）。
- 項目を削除: Cell を配列から除き、写真があれば Photo も削除する。
- 写真を貼れるのは項目の入ったマスだけ（FR-007）。

## Photo（写真）

`photos` ストアに保存する（キー: `id`）。ボードとは別に保存し、一覧表示で写真本体を読まずに済ませる。

| フィールド | 型 | 必須 | 説明 / 検証ルール |
|---|---|---|---|
| `id` | string (UUID v4) | ✓ | |
| `boardId` | string | ✓ | 所属ボード。インデックス `byBoard` を張り、ボード削除時にまとめて消す |
| `blob` | Blob (`image/jpeg`) | ✓ | 長辺 1600px 以下に縮小・再エンコード済み。EXIF なし（FR-015）。保存時は `bytes: ArrayBuffer` と `type` に変換する（下記） |
| `width` | integer | ✓ | 縮小後の幅（px） |
| `height` | integer | ✓ | 縮小後の高さ（px） |
| `thumbBlob` | Blob (`image/jpeg`) | ✓ | 長辺 320px のサムネイル。ボード画面の表示に使う（SC-006）。保存時は `thumbBytes: ArrayBuffer` に変換する |

**保存形式**: Safari はプライベートブラウズ（と Playwright の WebKit）で Blob を IndexedDB に保存できない
（"Error preparing Blob/File data to be stored in object store"）。そのため `photos` ストアには
`{ id, boardId, type, bytes: ArrayBuffer, thumbBytes: ArrayBuffer, width, height }` を保存し、読み出し時に Blob に戻す。
変換（`blob.arrayBuffer()`）はトランザクションを開く前に済ませる（途中で await するとトランザクションが自動で閉じるため）。

## Preferences（設定）

`meta` ストアのキー `"preferences"` に 1 件だけ保存する。

| フィールド | 型 | 既定値 | 説明 |
|---|---|---|---|
| `exportIncludeTitle` | boolean | `true` | 保存画像にタイトルを入れるか。前回の選択を記憶する（FR-013a） |
| `lastBackupAt` | string (ISO 8601) \| null | `null` | 最後にバックアップを書き出した日時。案内の表示判断に使う |
| `lastOpenedBoardId` | string \| null | `null` | 最後に開いたボードの ID。アプリ起動時に最初の 1 回だけ、このボードを開く |

## スキーマのバージョンと移行

- `meta` ストアのキー `"schemaVersion"` に整数で保存する。初版は `1`。
- IndexedDB の `onupgradeneeded` で、保存済みのバージョンから現在のバージョンまで移行関数を順に適用する
  （憲章 VI）。移行関数は単体テストで検証する。
- バックアップファイルの形式バージョンは、DB のスキーマバージョンとは別に管理する
  （[contracts/backup-format.md](./contracts/backup-format.md)）。

## マス目サイズの変更（FR-006）

1. 新しいサイズで範囲外になる Cell（`row ≥ rows` または `col ≥ cols`）を数える。
2. 1 件以上あれば、失われる項目数（写真付きの数も）を示して確認を求める。
3. 確認されたら範囲外の Cell と、その Photo を削除してから `size` を更新する。範囲内の Cell は同じ `row`, `col` のまま残す。

## マスの入れ替え（FR-005）

2 つの位置の Cell の `row`, `col` を交換する。片方が空マスなら、もう片方をその位置へ移動する。写真・表示範囲・達成日はそのまま引き継ぐ。

## 容量の目安

- 写真 1 枚: 本体 約 300〜500KB + サムネイル 約 30KB
- 5×5 のボード 3 つ（写真 75 枚）: 約 25〜40MB。ブラウザの保存容量内に収まる
- 書き込みで容量不足（`QuotaExceededError`）になった場合は、トランザクションを中止して既存データを保ち、ユーザーに通知する
