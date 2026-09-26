# Data Model: ボードが増えても使えるバックアップと読み込み

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md) | **Date**: 2026-09-26

001 の [data-model.md](../001-photo-bucket-list/data-model.md) からの差分だけを書く。`Board`・`Cell`・バックアップファイルの形式は変えない。

## DB スキーマ v2（`photo-bucket`、1 → 2）

### StoredPhoto（`photos` ストア）への追加

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `byteLength` | number | ✓ | 写真本体（`bytes`）のバイト数。サムネイルは含まない |

| 索引 | キー | 用途 |
|---|---|---|
| `byBoard`（既存） | `boardId` | ボードの写真を取り出す |
| `byBoardSize`（新規） | `[boardId, byteLength]` | 写真を読まずにボードごとの大きさを合計する（research.md R7） |

### ExportLog（`meta` ストア、キー `exportLog`、新規）

```ts
type ExportLog = Record<string /* boardId */, string /* 書き出した日時 ISO 8601 */>;
```

- ない場合は `{}` とみなす。
- 端末ごとの記録で、バックアップファイルには入れない（research.md R8）。

### マイグレーション 1 → 2

1. `photos` ストアをカーソルで 1 件ずつ読み、`byteLength = bytes.byteLength` を書き足す。
2. 索引 `byBoardSize` を作る。
3. `Preferences.lastBackupAt` があれば、`updatedAt <= lastBackupAt` のすべてのボードを `exportLog` にその日時で記録する（research.md R9）。
4. `schemaVersion` を 2 にする（既存の仕組み）。

マイグレーションは写真のデータを変えない（バイト列は同じ）。

## ボードの書き出し状態（画面で使う、保存しない）

| 状態 | 条件 | 表示 |
|---|---|---|
| `never` | `exportLog[id]` がない | 未書き出し |
| `changed` | `board.updatedAt > exportLog[id]` | 変更あり |
| `stale` | 上のどちらでもなく、`exportLog[id]` が 30 日以上前 | M月D日に書き出し（案内の対象） |
| `fresh` | それ以外 | M月D日に書き出し |

- バックアップの案内（FR-019）は、写真のあるボードに `never`・`changed`・`stale` が 1 つでもあれば出す。

### ExportLog の更新

| 出来事 | ExportLog |
|---|---|
| 書き出したファイルを共有・ダウンロードに渡せた | 入れたボードすべてを今の日時に |
| 共有シートをキャンセルした、書き出しに失敗した | 変えない |
| ボードを削除した | そのボードの記録を消す |
| 読み込みでボードを書き込んだ（追加・上書き・別として追加） | 書き込んだボードの記録を消す（未書き出しに戻す） |
| 「すべて置き換える」で端末のボードを削除した | 削除したボードの記録を消す |

## 読み込みの状態（画面で使う、保存しない）

### ImportSource（読み込むファイル）

| フィールド | 説明 |
|---|---|
| `file` | 選んだファイル |
| `boards` | 検査（`inspectBackup`）で得たボードの一覧（写真の本体は含まない） |
| `photos` | 写真の情報（ID・ボード ID・種類・大きさ・ZIP 内の場所） |

### ImportPlan（読み込みの計画）

| フィールド | 説明 |
|---|---|
| `mode` | `"replace"`（すべて置き換える）または `"add"`（追加する） |
| `onConflict` | `mode = "add"` のときの同じボードの扱い: `"overwrite"` / `"copy"` / `"skip"` |
| `items` | 読み込むボードの一覧。同じ ID が複数のファイルにあれば `updatedAt` の新しいほうだけ（同じなら後に追加したファイル）。各要素はどのファイルのボードかを持つ |
| `conflicts` | 端末に同じ ID があるボードの数 |
| `deleteCount` | `mode = "replace"` で削除される端末のボード数（バックアップにない端末のボード） |

### ボードごとの結果

`"added"` / `"overwritten"` / `"copied"` / `"skipped"` / `"failed"`（＋理由: 写真のデータが欠けている／容量不足／その他）

### 読み込みダイアログの状態遷移

```text
choosing（ファイルを追加・読み込み方を選ぶ）
  ──[読み込む]──▶ (mode=replace なら) confirming ──[置き換える]──▶ running
  ──[読み込む]──▶ (mode=add なら) running
running（i / n ボード）──[全ボード終了]──▶ (replace かつ failed=0 なら 端末のボードを削除) ──▶ done（結果）
running ──[容量不足]──▶ done（残りは failed: 容量不足）
done ──[閉じる]──▶ ボード一覧
```

## 定数

| 名前 | 値 | 説明 |
|---|---|---|
| `BACKUP_MAX_BOARDS` | 10 | 1 回に書き出せるボード数の上限（FR-015） |
| `BACKUP_REMIND_DAYS` | 30 | 案内を出すまでの日数（今の `THIRTY_DAYS`） |
