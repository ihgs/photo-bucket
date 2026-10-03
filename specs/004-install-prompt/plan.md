# Implementation Plan: ホーム画面への追加を促す案内

**Branch**: `004-install-prompt` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-install-prompt/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

ブラウザで開いているとき、ボード一覧の上部に、ホーム画面への追加を案内する帯を出す。
ブラウザが「追加できます」と合図してくる端末（Chrome・Edge）ではボタン1つで追加画面を開き、iPhone・iPad・Mac の Safari では手順を示し、
アプリ内ブラウザでは普通のブラウザで開き直すよう案内する。閉じたら 30 日後に一度だけ再表示する。
iPhone などデータが引き継がれない端末でボードがあるときは、先にバックアップを書き出すよう添える。

技術的な要点（詳細は [research.md](./research.md)）:

1. **案内の種類は純粋関数で決める**: ユーザーエージェント・単独表示かどうか・合図の有無から `InstallGuide` を 1 つ決める（R1）。テストで端末ごとに確かめられる。
2. **合図を取りこぼさない**: `beforeinstallprompt` は早く来るので、描画より前に受け取って保持する（R2）。
3. **記録は `meta` に 1 キー**: 閉じた回数・日時・追加済みを持つ。スキーマの変更なし（R4）。

## Technical Context

**Language/Version**: TypeScript（strict）、Vite、Node.js 24（001 と同じ）

**Primary Dependencies**: 追加なし（Preact、@preact/signals、idb、lucide-preact の `Share` アイコン）

**Storage**: IndexedDB の `meta` ストアにキー `installPrompt` を追加（スキーマの変更なし）。[data-model.md](./data-model.md)

**Testing**: Vitest（種類の判定・表示の判定・記録の読み書き）、Playwright の Chromium（合図を疑似的に送る）・WebKit（iPhone の UA）、実機での手動確認

**Target Platform**: 001 と同じ（最新の iOS Safari、Android Chrome、デスクトップの Chrome・Edge・Safari）。Firefox は対象外

**Project Type**: クライアントのみの Web アプリ（PWA）

**Performance Goals**: ボード一覧の表示を遅らせない（記録の読み込みは一覧と並行し、帯はあとから出る）

**Constraints**: 外部通信なし。操作を隠さない。初回読み込みの JS は gzip 60KB 以下を維持（増加は 2KB 程度）

**Scale/Scope**: 帯 1 つ、新しいファイルは `src/pwa/installPrompt.ts`・`src/ui/components/InstallBanner.tsx` の 2 つ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

憲章 v1.2.0 に対して確認する。

| 原則 | 確認内容 | 設計前 | 設計後 |
|---|---|---|---|
| I. ローカルファースト & プライバシー | 外部通信なし。記録は端末内（`meta`）だけ。表示回数などの集計はしない | ✅ | ✅ |
| II. 静的ホスティング前提 | 変更なし | ✅ | ✅ |
| III. オフライン対応 PWA | インストールを促すことで原則 III を後押しする。帯はオフラインでも表示できる | ✅ | ✅ |
| IV. モバイルファースト & アクセシビリティ | 360px 幅の帯、44px 以上のボタン、見出しで名前を付けたセクション、Share アイコンに読み上げ名（contracts/install-banner.md） | ✅ | ✅ |
| V. シンプルさ & 最小依存 | 依存の追加なし。既存の `.banner` の見た目を使う | ✅ | ✅ |
| VI. データの可搬性と画像出力の忠実性 | DB スキーマ・バックアップ形式は変えない。iPhone での引き継ぎはバックアップ（003）で行うよう案内する | ✅ | ✅ |

違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/004-install-prompt/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── install-banner.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── pwa/
│   └── installPrompt.ts        # 新規: detectGuide・shouldShowBanner（純粋関数）、合図の保持（signal）、記録の読み書き
├── ui/
│   ├── components/
│   │   └── InstallBanner.tsx   # 新規: 帯（種類ごとの内容、引き継ぎの注意、閉じる・追加）
│   └── screens/
│       └── BoardList.tsx       # 変更: 先頭に InstallBanner を置く（ボードの有無どちらも）
├── main.tsx                    # 変更: 描画より前に installPrompt を読み込んで合図を受け取る
└── styles/base.css             # 変更: 帯の手順リスト・アイコン

tests/
├── unit/install-guide.test.ts          # 新規
├── integration/install-record.test.ts  # 新規
└── e2e/
    ├── install-banner.spec.ts          # 新規
    └── a11y.spec.ts                    # 変更
```

**Structure Decision**: 001 と同じ単一プロジェクト構成。判定と記録は `src/pwa/installPrompt.ts` にまとめ、画面は `InstallBanner` に閉じ込める。
既存の E2E は、帯が出てもボード一覧の操作を隠さないので、そのまま動く想定（動かない場合はテスト側で帯を閉じた記録を入れる）。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

違反なし。
