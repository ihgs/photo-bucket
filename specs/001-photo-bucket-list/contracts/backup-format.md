# Contract: バックアップファイル形式

**Related**: FR-024, FR-025, SC-007 / [data-model.md](../data-model.md) / [research.md](../research.md) R11

アプリが書き出し、読み込むバックアップファイルの形式を定める。アプリの外に出る唯一のデータ形式である。
テスト運用中のため、以前の JSON 形式（`.photobucket.json`）は読み込まない（Clarifications 2026-09-24）。

## ファイル

- 形式: ZIP（圧縮なし = stored、ZIP64 は使わない）。ファイル名は UTF-8（汎用フラグ bit 11）
- ファイル名: `photo-bucket-<YYYYMMDD-HHmm>.pbz`
- MIME タイプ: `application/zip`
- 書き出し単位: 「すべてのボード」または「選んだ 1 ボード」

## ZIP の中身

```text
backup.json               ボード・マス・写真の情報（写真の本体は含まない）。最初のエントリにする
photos/<photoId>.jpg      写真の本体（取り込み時のバイト列そのまま）。PNG は .png、WebP は .webp
```

## backup.json（formatVersion 1）

```jsonc
{
  "format": "photo-bucket-backup",      // 固定値。これ以外は読み込まない
  "formatVersion": 1,                    // 整数。アプリが知らない大きい値なら読み込まない
  "exportedAt": "2026-09-23T10:00:00.000Z",
  "boards": [
    {
      "id": "8f0c…",                     // UUID
      "title": "2026年やりたいこと",
      "size": { "cols": 3, "rows": 4 },  // data-model.md の GridSize 5 種類のみ
      "createdAt": "…",
      "updatedAt": "…",
      "cells": [
        {
          "id": "…",
          "row": 0, "col": 2,
          "title": "京都で抹茶パフェを食べる",
          "category": "eat",             // want | go | eat | other
          "memo": "",
          "photoId": "…",                // 任意
          "crop": { "cx": 0.5, "cy": 0.4, "zoom": 1.2, "rotation": 90 },  // photoId があるとき必須。rotation は任意（0/90/180/270）
          "achievedAt": "…"              // photoId があるとき必須
        }
      ]
    }
  ],
  "photos": [
    {
      "id": "…",
      "boardId": "8f0c…",
      "width": 1600, "height": 1200,
      "type": "image/jpeg",              // image/jpeg | image/png | image/webp
      "path": "photos/….jpg"             // ZIP 内のエントリ名。サムネイルは入れず、読み込み時に再生成する
    }
  ]
}
```

## 読み込み時の検証（FR-025）

ファイル名や拡張子では判定しない。次のいずれかに当てはまる場合は、**何も書き込まずに**中止し、理由を日本語で表示する。

| 条件 | 表示するメッセージ |
|---|---|
| ZIP として読めない、圧縮されたエントリがある、CRC32 が合わない、`backup.json` が JSON として読めない | 「バックアップファイルを読み込めませんでした（ファイルが壊れている可能性があります）」 |
| `backup.json` がない、または `format` が `"photo-bucket-backup"` でない | 「このアプリのバックアップファイルではありません」 |
| `formatVersion` がアプリの対応範囲より大きい | 「新しいバージョンのアプリで作られたファイルです。アプリを更新してください」 |
| フィールドが data-model.md の検証ルールに合わない | 「ファイルの内容に誤りがあります」 |
| `photoId` が参照する写真が `photos` にない、`path` のエントリが ZIP にない、`type` が画像でない、または画像として読めない | 「写真のデータが欠けています」 |

すべての検証に通ったあと、1 つの IndexedDB トランザクションでまとめて書き込む。途中で失敗したら
トランザクションごと取り消す。

## ID が重複した場合

端末に同じ `id` のボードがあるときは、ボードごとにユーザーが選ぶ。

- **上書き**: 既存のボードとその写真を削除し、ファイルの内容で置き換える。
- **別のボードとして追加**: ボード・マス・写真に新しい ID を振って追加する（タイトルの末尾に「（復元）」を付ける）。

## 互換性のルール

- フィールドの追加は `formatVersion` を上げずに行ってよい。読み込み側は知らないフィールドを無視する。
- フィールドの削除・意味の変更は `formatVersion` を上げ、古い形式を読み込むための変換処理を残す。
- 往復の保証: 書き出し → 読み込みで、ボード・マス・写真・表示範囲・達成日がすべて一致すること（SC-007）。
  写真は同じバイト列で戻る（再エンコードしない）。
