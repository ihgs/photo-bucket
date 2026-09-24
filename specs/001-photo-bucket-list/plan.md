# Implementation Plan: 写真型バケットリスト

**Branch**: `001-photo-bucket-list` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-photo-bucket-list/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

マス目（3×3・4×4・5×5・3×4・4×3）に「やりたいこと・行きたいところ・食べたいもの」を書き込み、
達成したら写真を貼り、最後にボード全体を一枚の画像（1:1・3:4・4:3 ちょうど）として保存・共有できる
PWA を作る。サーバーを持たない静的サイトとして GitHub Pages で公開し、データはすべて端末内の
IndexedDB に保存する。

技術的な要点は次の 3 つ（詳細は [research.md](./research.md)）。

1. **画面と保存画像の一致**: レイアウト計算を純粋関数 `layoutBoard` に集約し、画面（DOM）と
   保存画像（Canvas）の両方がその結果だけで描画する（R6）。
2. **写真の扱い**: 取り込み時に長辺 1600px へ縮小・再エンコードして EXIF を除去し、
   表示範囲は解像度に依存しない `{cx, cy, zoom}` で保存する（R4, R5）。
3. **オフライン**: Service Worker でアプリ全体を precache し、ユーザーデータは IndexedDB に分けて持つ（R3, R9）。

**2026-09-24 追加**: ボードが 1 つもないとき、ボード一覧に 4 つの手順の使い方を表示する（FR-028）。
ボード一覧が空かどうかだけで出し分け、データモデルと依存は変えない（R14）。

**2026-09-24 変更**: バックアップを JSON から ZIP（拡張子 `.pbz`、写真はバイト列のまま）に変える（FR-024, R11）。
依存は増やさず、以前の JSON 形式との互換は持たない。

## Technical Context

**Language/Version**: TypeScript（strict）、ビルドは Vite（実装時点の最新安定版）、Node.js 24（開発・CI）

**Primary Dependencies**: 実行時 — Preact、@preact/signals、idb。ビルド時 — Vite、vite-plugin-pwa（Workbox）

**Storage**: IndexedDB（`boards`・`photos`・`meta` ストア）。写真は JPEG の Blob。詳細は [data-model.md](./data-model.md)

**Testing**: Vitest + happy-dom + fake-indexeddb + @testing-library/preact（単体・結合）、Playwright の Chromium・WebKit（E2E）

**Target Platform**: 最新の iOS Safari、Android Chrome、デスクトップの Chrome・Edge・Safari（Firefox は対象外）。GitHub Pages のサブパス `/photo-bucket/` で配信

**Project Type**: クライアントのみの Web アプリ（PWA）。バックエンドなし

**Performance Goals**: 写真 25 枚のボードを 2 秒以内に表示（SC-006）、25 枚のボードの画像書き出し 5 秒以内（SC-003）、操作への反応 100ms 以内

**Constraints**: 完全オフライン動作、外部通信なし、初回読み込みの JS は gzip で 60KB 以下を目標、保存画像は長辺 2400px

**Scale/Scope**: 利用者 1 人・1 端末。ボード数十個、写真 1 ボード最大 25 枚。画面 7 つ（[contracts/ui-routes.md](./contracts/ui-routes.md)）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 確認内容 | 設計前 | 設計後 |
|---|---|---|---|
| I. ローカルファースト & プライバシー | データは IndexedDB のみ。外部通信・分析ツールなし。取り込み時の再エンコードで EXIF を除去（R4） | ✅ | ✅ |
| II. 静的ホスティング前提 | Vite の静的出力。`BASE_PATH` によるサブパス対応。ハッシュルーティング（R10）。Actions からデプロイ（R13） | ✅ | ✅ |
| III. オフライン対応 PWA | vite-plugin-pwa で Manifest と Service Worker を生成し全ファイルを precache。更新は prompt 方式で、データは IndexedDB に分離（R9） | ✅ | ✅ |
| IV. モバイルファースト & アクセシビリティ | 360px 幅基準。撮影とライブラリの 2 ボタン。タップ領域 44px 以上、読み上げラベル、ドラッグ不要の移動モード（ui-routes.md） | ✅ | ✅ |
| V. シンプルさ & 最小依存 | 実行時依存は Preact・@preact/signals・idb の 3 つ（合計 gzip 約 7KB）。追加理由は research.md R2・R3 に記録。ルーターや画像化ライブラリは不採用 | ✅ | ✅ |
| VI. データの可搬性と画像出力の忠実性 | マス目サイズはデータで表現（固定なし）。`layoutBoard` の共有で画面と画像を一致させる。ZIP（`.pbz`）のバックアップ（依存なしの自前実装、R11）。スキーマのバージョンと移行（data-model.md） | ✅ | ✅ |
| 技術的制約 | Canvas による画像合成、JSX の自動エスケープ（`innerHTML` 不使用）、日本語 UI、容量超過の通知 | ✅ | ✅ |
| 品質ゲート | データモデルと移行、画像出力ロジック、保存と読み込みの自動テスト。サブパス配信でのオフライン E2E（quickstart.md） | ✅ | ✅ |

違反はないため、Complexity Tracking は空とする。

## Project Structure

### Documentation (this feature)

```text
specs/001-photo-bucket-list/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── backup-format.md
│   ├── export-image.md
│   └── ui-routes.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
index.html
vite.config.ts               # base = BASE_PATH、vite-plugin-pwa の設定（Manifest を含む）
package.json
tsconfig.json
playwright.config.ts
public/
└── icons/                   # PWA アイコン（192, 512, maskable, apple-touch-icon）

src/
├── main.tsx                 # 起動、Service Worker 登録、persist() の要求
├── app/
│   ├── App.tsx              # ハッシュルーター、共通の通知（更新・容量・オフライン）
│   └── router.ts
├── domain/                  # UI・保存に依存しない純粋ロジック
│   ├── types.ts             # Board, Cell, Crop, Photo, GridSize
│   ├── grid.ts              # GridSize の定義、サイズ変更、マスの入れ替え、達成数
│   ├── crop.ts              # 表示範囲の制限と、元画像からの切り出し矩形の計算
│   └── layout.ts            # layoutBoard（マス位置、文字サイズ、行分割、タイトル帯）
├── storage/
│   ├── db.ts                # IndexedDB の開き方、スキーマバージョンと移行
│   ├── boards.ts            # ボードとマスの読み書き
│   └── photos.ts            # 写真の読み書き、ボード削除時の一括削除
├── media/
│   ├── importPhoto.ts       # デコード、縮小、再エンコード、サムネイル生成
│   ├── renderBoard.ts       # layoutBoard の結果を Canvas に描画
│   └── shareImage.ts        # Web Share API とダウンロードの切り替え
├── backup/
│   ├── zip.ts               # 圧縮なし ZIP の書き込み・読み込み、CRC32
│   ├── exportBackup.ts
│   └── importBackup.ts      # 検証、ID 重複時の選択、1 トランザクションでの書き込み
├── ui/
│   ├── screens/             # BoardList, NewBoard, BoardView, CellSheet, CropEditor, ExportDialog, BoardSettings
│   └── components/          # GridView, CellTile, CategoryBadge, ConfirmDialog, Toast など
└── styles/

tests/
├── unit/                    # domain/*, backup の検証, storage/db の移行
├── integration/             # storage + fake-indexeddb、画面コンポーネント
└── e2e/                     # Playwright（quickstart.md のシナリオ 1〜6）

.github/workflows/
└── deploy.yml               # lint → test → build → e2e → GitHub Pages へ公開
```

**Structure Decision**: バックエンドがないため、リポジトリ直下を 1 つのフロントエンドプロジェクトとする。
`src/domain` は UI・保存から独立した純粋関数だけを置き、画面と保存画像の一致（憲章 VI）と
単体テストのしやすさを確保する。`storage`・`media`・`backup` はブラウザ API との境界で、
`ui` はそれらを組み合わせるだけにする。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

違反なし。
