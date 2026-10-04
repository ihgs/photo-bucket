# Implementation Plan: テンプレートからボードを作る

**Branch**: `005-board-templates` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-board-templates/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

「新しいボード」の画面で、空のボードのほかに 4 つのテンプレート（国内旅行・一年の目標・今年のベストごはん・季節の楽しみ）から選べるようにする。
選ぶとタイトル（年の入るものは今年の年）とサイズが入り、作るとテンプレートの項目が入ったボードが 1 回で保存される。

技術的な要点（詳細は [research.md](./research.md)）:

1. **テンプレートはコードの定数**: 型で形を守り、単体テストで中身の決まり（項目数・文字数・数字を含まない など）を確かめる（R1, R2）。
2. **1 回で保存**: `createBoard` に最初のマスを渡せるようにし、中途半端なボードを残さない（R4）。保存するデータの形は変わらない。
3. **画面は今の「新しいボード」に足すだけ**: テンプレートの選択、項目のプレビュー、選択中はサイズを固定（R5）。

## Technical Context

**Language/Version**: TypeScript（strict）、Vite、Node.js 24（001 と同じ）

**Primary Dependencies**: 追加なし（Preact、@preact/signals、idb）

**Storage**: 変更なし（ボードは今までと同じ形で保存。テンプレートは保存しない）

**Testing**: Vitest（テンプレートの検証・年の置き換え・マスの生成・保存）、Playwright の Chromium・WebKit（画面の操作）

**Target Platform**: 001 と同じ

**Project Type**: クライアントのみの Web アプリ（PWA）

**Performance Goals**: テンプレートを選んでからタイトル・サイズ・プレビューが変わるまで即時（通信・保存なし）

**Constraints**: オフラインで使える。初回読み込みの JS は gzip 60KB 以下を維持（増加は 1〜2KB）

**Scale/Scope**: テンプレート 4 つ・計 62 項目。新しいファイルは `src/domain/templates.ts` と `src/ui/components/TemplatePicker.tsx`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

憲章 v1.2.0 に対して確認する。

| 原則 | 確認内容 | 設計前 | 設計後 |
|---|---|---|---|
| I. ローカルファースト & プライバシー | テンプレートはアプリに含め、外部通信なし | ✅ | ✅ |
| II. 静的ホスティング前提 | 変更なし | ✅ | ✅ |
| III. オフライン対応 PWA | テンプレートはビルドに含まれ precache される | ✅ | ✅ |
| IV. モバイルファースト & アクセシビリティ | ラジオグループで選択、44px 以上、プレビューは見出し付き。360px 幅で 5×5 のプレビューも折り返して読める（contracts/） | ✅ | ✅ |
| V. シンプルさ & 最小依存 | 依存の追加なし。新しい画面を作らない | ✅ | ✅ |
| VI. データの可搬性と画像出力の忠実性 | ボードの形・DB スキーマ・バックアップ形式は変えない。テンプレートから作ったボードも普通のボードとして書き出せる | ✅ | ✅ |

違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/005-board-templates/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── new-board-templates.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── templates.ts            # 新規: 型、TEMPLATES（4 つ）、resolveTemplateTitle、cellsFromTemplate
├── storage/
│   └── boards.ts               # 変更: createBoard(title, size, cells = [])
├── ui/
│   ├── components/
│   │   ├── SizePicker.tsx      # 変更: disabled を受け取る
│   │   └── TemplatePicker.tsx  # 新規: テンプレートの選択と項目のプレビュー
│   └── screens/
│       └── NewBoard.tsx        # 変更: テンプレートの選択、タイトル・サイズの切り替えと復元
└── styles/base.css             # 変更: テンプレートの選択肢・プレビュー

tests/
├── unit/templates.test.ts                 # 新規
├── integration/boards-storage.test.ts     # 変更
└── e2e/
    ├── templates.spec.ts                  # 新規
    └── a11y.spec.ts                       # 変更
```

**Structure Decision**: 001 と同じ単一プロジェクト構成。テンプレートの中身と純粋関数は `src/domain/templates.ts`、画面は `TemplatePicker` に分け、
`NewBoard` は選択の状態とタイトル・サイズの切り替えだけを持つ。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

違反なし。
