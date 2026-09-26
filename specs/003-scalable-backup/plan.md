# Implementation Plan: ボードが増えても使えるバックアップと読み込み

**Branch**: `003-scalable-backup` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-scalable-backup/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

ボードが増えてもバックアップと読み込みが確実にできるようにする。
読み込みは 1 ボード＝1 トランザクションで順に行って進み具合を出し、「すべて置き換える／追加する」と同じボードの扱いを
1 回で選べるようにする。書き出しは専用の画面でボードを選び、1 回 10 ボードまでとする。

技術的な要点は次の 4 つ（詳細は [research.md](./research.md)）。

1. **検査と書き込みを分ける**: 検査は `backup.json` だけを読み、写真はボードを書き込むときにそのボードの分だけ ZIP から切り出す。
   メモリは 1 ボード分（最大約 20MB）で済む（R1）。
2. **置き換えは削除を最後に**: バックアップのボードをすべて書き込めたときだけ、端末の残りのボードを消す。
   途中で失敗しても、もとのボードは消えない（R3）。
3. **大きさは写真を読まずに**: DB スキーマを v2 にして写真のバイト数と複合索引を持ち、索引のキーだけで合計する（R7）。
4. **書き出し記録はボードごと**: `meta` に ExportLog を持ち、「未書き出し」「変更あり」の表示とバックアップの案内に使う（R8, R9）。

バックアップファイルの形式は変えない（R10）。

## Technical Context

**Language/Version**: TypeScript（strict）、Vite、Node.js 24（001 と同じ）

**Primary Dependencies**: 追加なし（Preact、@preact/signals、idb のまま）。ZIP は既存の自前実装（`src/backup/zip.ts`）

**Storage**: IndexedDB。スキーマ 1 → 2（`photos` に `byteLength` と索引 `byBoardSize`、`meta` に `exportLog`）。[data-model.md](./data-model.md)

**Testing**: Vitest + happy-dom + fake-indexeddb（検査・計画・ボードごとの書き込み・マイグレーション）、Playwright の Chromium・WebKit（書き出す画面・読み込みダイアログ）、実機での大容量の確認

**Target Platform**: 001 と同じ（最新の iOS Safari、Android Chrome、デスクトップの Chrome・Edge・Safari）

**Project Type**: クライアントのみの Web アプリ（PWA）

**Performance Goals**: 読み込み開始から 1 秒以内に進み具合を表示（SC-003）、写真を全部埋めた 5×5 のボード 10 個を中程度のスマートフォンで 2 分以内に読み込む（SC-004）、書き出す画面の大きさの表示は写真を読まずに即時

**Constraints**: 読み込み時のメモリは 1 ボード分。読み込みの途中の失敗でもとのボードを失わない。1 回の書き出しは 10 ボード（最大約 200MB）まで。オフラインで動く。初回読み込みの JS は gzip 60KB 以下を維持（書き出す画面と読み込みダイアログは小さいため分割しない）

**Scale/Scope**: ボードは数十個、1 ボードの写真は最大 25 枚。画面 1 つ（`#/backup`）とダイアログ 1 つを追加

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

憲章 v1.2.0 に対して確認する。

| 原則 | 確認内容 | 設計前 | 設計後 |
|---|---|---|---|
| I. ローカルファースト & プライバシー | 書き出し・読み込みとも端末内で完結し、外部通信なし。ExportLog も端末内だけ | ✅ | ✅ |
| II. 静的ホスティング前提 | 変更なし。新しいルートもハッシュルーティング | ✅ | ✅ |
| III. オフライン対応 PWA | 書き出し・読み込みともオフラインで動く。データは IndexedDB に分けたまま | ✅ | ✅ |
| IV. モバイルファースト & アクセシビリティ | 書き出す画面は 360px 幅でチェック付きの一覧と下部固定のバー。行全体がタップ領域。進み具合は `aria-live`。上限の案内は `role="status"`（contracts/） | ✅ | ✅ |
| V. シンプルさ & 最小依存 | 依存の追加なし。ZIP は既存の実装を使う | ✅ | ✅ |
| VI. データの可搬性と画像出力の忠実性 | バックアップの形式は変えず、今までのファイルも読める（R10）。**DB スキーマを 1 → 2 に上げ、マイグレーションを用意してテストする**（data-model.md）。写真のバイト列は変えない | ✅ | ✅ |

**品質ゲート**: 憲章が自動テストを求める「データモデルとスキーマ移行」「ストレージの保存・読み込み」に当たるため、
マイグレーション 1 → 2 と、ボードごとの読み込み・置き換えの順序を単体・結合テストで確かめる（quickstart.md）。

違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/003-scalable-backup/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   ├── backup-export.md # 書き出す画面（#/backup）
│   └── backup-import.md # 読み込みダイアログ
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── backup/
│   ├── format.ts            # 変更: BACKUP_MAX_BOARDS
│   ├── exportBackup.ts      # 変更: 1〜10 ボードに限定、1 ボードずつ写真を読む、estimateBackupSize
│   ├── importBackup.ts      # 変更: parseBackup → inspectBackup（写真を読まない）、importBoard（1 ボード＝1 トランザクション）
│   ├── importPlan.ts        # 新規: planImport（複数ファイルの統合・件数）、runImportPlan（順に実行・置き換えの削除）
│   └── exportLog.ts         # 新規: ExportLog の読み書き、書き出し状態の判定、案内の条件
├── storage/
│   ├── db.ts                # 変更: マイグレーション 1 → 2、StoredPhoto.byteLength
│   ├── photos.ts            # 変更: toStored で byteLength を設定
│   └── boards.ts            # 変更: deleteBoard で ExportLog の記録も消す
├── app/
│   └── router.ts            # 変更: #/backup、#/backup/pending
├── ui/
│   ├── backupActions.ts     # 変更: runExport(boardIds) で ExportLog を更新。runImport は ImportDialog に置き換え
│   ├── components/
│   │   ├── BackupReminder.tsx  # 変更: ExportLog で判定、#/backup/pending へ
│   │   └── ImportDialog.tsx    # 新規: choosing → confirming → running → done
│   └── screens/
│       ├── BackupExport.tsx    # 新規: 書き出す画面
│       ├── BoardList.tsx       # 変更: 「書き出す」は #/backup へ、「読み込む」は ImportDialog を開く
│       └── BoardDangerZone.tsx # 変更なし（runExport([id]) のまま）
└── styles/base.css          # 変更: 書き出す画面の一覧・下部バー、読み込みダイアログ

tests/
├── unit/
│   ├── db.test.ts               # 変更: マイグレーション 1 → 2
│   ├── import-plan.test.ts      # 新規
│   ├── export-state.test.ts     # 新規
│   ├── backup-reminder.test.ts  # 変更
│   └── router.test.ts           # 変更
├── integration/
│   ├── import-run.test.ts       # 新規
│   └── backup-roundtrip.test.ts # 変更
└── e2e/
    ├── us5-backup.spec.ts       # 変更
    └── a11y.spec.ts             # 変更

specs/001-photo-bucket-list/
├── contracts/ui-routes.md       # 変更: #/backup を追加
└── contracts/backup-format.md   # 変更: 書き出しは 10 ボードまで、重複時の扱いを 003 に合わせる
```

**Structure Decision**: 001 と同じ単一プロジェクト構成。読み込みの処理は `src/backup/` の純粋な計画（`importPlan.ts`）と
IndexedDB への書き込みに分け、画面は `ImportDialog` に閉じ込める。001 の contracts のうち、この機能で意味が変わるものは同じ PR で更新する。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

違反なし。
