# Implementation Plan: 外部のテンプレートを取り込む

**Branch**: `006-template-import` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-template-import/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

テンプレートを選ぶシートに「テンプレートを取り込む」を足し、公開された形式（JSON）のテンプレートを、貼り付けまたは https の URL から取り込めるようにする。
取り込んだテンプレートは、アプリに入っているテンプレートを選んだときと同じ流れでボードを作るのに使い、保存はしない。

技術的な要点（詳細は [research.md](./research.md)）:

1. **形式はマス目そのままの 2 次元配列**: `rows: [["項目", {title, category}, null], …]`。手で書きやすく、位置の誤りが起きない（R1）。
2. **検証は純粋関数 `parseTemplate`**: 誤りは位置付きの日本語でまとめて返す（R2）。結果は既存の `BoardTemplate` の形にする。
3. **URL は `fetch` だけ**: 資格情報・Referer を送らず、10 秒・100 KB で打ち切る。CORS を許可していない公開先は貼り付けで補う（R3）。
4. **憲章 I を v1.3.0 に改定**: 「ユーザーが入れた URL からテンプレートを読む通信」を例外に加える（R5）。実装の最初に行う。
5. **画面はシートの中身を切り替えるだけ**: `NewBoard` の状態を「選んだテンプレートそのもの」にし、取り込んだものも同じ流れに乗せる（R6）。

## Technical Context

**Language/Version**: TypeScript（strict）、Vite、Node.js 24（001 と同じ）

**Primary Dependencies**: 追加なし（Preact、@preact/signals、idb、lucide-preact）

**Storage**: 変更なし（取り込んだテンプレートは保存しない。ボードは今までと同じ形）

**Testing**: Vitest（`parseTemplate`・`fetchTemplateText`）、Playwright の Chromium・WebKit（`page.route` で外部の URL を模擬）

**Target Platform**: 001 と同じ（最新の iOS Safari・Android Chrome・デスクトップの Chrome / Edge / Safari）

**Project Type**: クライアントのみの Web アプリ（PWA）

**Performance Goals**: 貼り付けの取り込みは即時（100 KB の JSON の検証で 50ms 以内）。URL の読み込みは最長 10 秒で打ち切る

**Constraints**: 貼り付けはオフラインで使える。初回読み込みの JS は gzip 60KB 以下を維持（今 35.8KB。増加は 2〜3KB の見込み）。
外部への要求は、ユーザーが入れた URL への GET だけ（資格情報・Referer なし）

**Scale/Scope**: 新しいファイルは `src/domain/templateFormat.ts`・`src/net/fetchTemplate.ts`・`src/ui/components/TemplateImport.tsx`。
変更は `NewBoard.tsx`・`TemplatePicker.tsx`・`templates.ts`（型に `imported?` を足す）・`base.css`・README・憲章

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

憲章 v1.2.0 に対して確認する。

| 原則 | 確認内容 | 設計前 | 設計後 |
|---|---|---|---|
| I. ローカルファースト & プライバシー | URL からの読み込みは、広告以外の外部通信になる。今の憲章では改定が必要 | ⚠️ 改定が必要 | ✅ 改定（v1.3.0）を最初のタスクにする。送るのは URL への GET だけで、資格情報・Referer・端末内のデータは送らない（R3・R5）。E2E で確かめる |
| II. 静的ホスティング前提 | プロキシなどのサーバーを置かない。CORS を許可していない公開先は貼り付けで補う | ✅ | ✅ |
| III. オフライン対応 PWA | 貼り付けはオフラインで使える。URL はオフラインで使えないことを表示する。Service Worker は変えない（R4） | ✅ | ✅ |
| IV. モバイルファースト & アクセシビリティ | シートの中身の切り替えで、ラベル・`role="alert"`・フォーカスの戻し・44px を守る（contracts/import-ui.md） | ✅ | ✅ |
| V. シンプルさ & 最小依存 | 依存の追加なし（JSON の解析・検証・`fetch` は標準）。新しい画面・保存先を作らない | ✅ | ✅ |
| VI. データの可搬性と画像出力の忠実性 | ボードの形・DB スキーマ・バックアップ形式は変えない。形式に `version` を持たせる | ✅ | ✅ |
| 技術的制約: `innerHTML` の禁止 | 取り込んだ文字は JSX の文字として描くだけ（R7） | ✅ | ✅ |

原則 I は、改定を前提に通過とする。改定しない場合は、User Story 2（URL）を外し、貼り付けだけを実装する（Complexity Tracking）。

## Project Structure

### Documentation (this feature)

```text
specs/006-template-import/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   ├── template-format.md   # 公開する形式（README に載せる）
│   └── import-ui.md         # 取り込み画面
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
.specify/memory/constitution.md       # 変更: v1.3.0（原則 I に例外を追加）
README.md                             # 変更: 「テンプレートを作る」（形式・例・公開先の案内）

src/
├── domain/
│   ├── templates.ts                  # 変更: BoardTemplate に imported?: true
│   └── templateFormat.ts             # 新規: parseTemplate（形式の検証と BoardTemplate への変換）
├── net/
│   └── fetchTemplate.ts              # 新規: fetchTemplateText（外部と通信する唯一の場所）
├── ui/
│   ├── components/
│   │   ├── TemplatePicker.tsx        # 変更: シートに「テンプレートを取り込む」、取り込み画面への切り替え、プレビューの空きマス・「取り込んだテンプレート」
│   │   └── TemplateImport.tsx        # 新規: 取り込み画面（URL・貼り付け・誤りの表示）
│   └── screens/
│       └── NewBoard.tsx              # 変更: 状態を BoardTemplate | null に
└── styles/base.css                   # 変更: 取り込み画面

tests/
├── unit/
│   ├── templateFormat.test.ts        # 新規
│   └── fetchTemplate.test.ts         # 新規
└── e2e/
    ├── template-import.spec.ts       # 新規
    ├── privacy.spec.ts               # 変更: URL の取り込みで送るものの確認を追加
    └── a11y.spec.ts                  # 変更: 取り込み画面と誤りの表示
```

**Structure Decision**: 001 と同じ単一プロジェクト構成。形式の検証は副作用のない `domain` に、外部との通信は新しい `net` に分け、
外部通信のコードが 1 か所にしかないことを見て分かるようにする（憲章 I の確認がしやすい）。画面は 005 の `TemplatePicker` のシートに足す。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 原則 I: 広告以外の外部通信（URL からテンプレートを読む） | ユーザーが求めた「公開した JSON の URL で共有する」使い方のため。ユーザーが URL を入れて指示したときだけ、GET だけを送り、端末内のデータは送らない | 貼り付けだけにする案は、改定なしで済むが、URL での共有ができなくなる。プロキシ経由は第三者に URL が渡り、通信先も増える。憲章を v1.3.0 に改定して例外として明記する（R5） |
