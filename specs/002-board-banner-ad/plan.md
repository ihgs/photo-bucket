# Implementation Plan: ボード画面の帯広告

**Branch**: `002-board-banner-ad` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-board-banner-ad/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

ボード画面（`#/boards/:id`）の下端に、Google AdSense の 320×50 の帯広告を 1 つ固定して表示する。
広告はボードの描画後に読み込み、出せないとき（オフライン・失敗・ブロック・在庫なし）は枠ごと詰める。
ボードの内容・写真は外部へ送らず、保存画像にも広告は入らない。

技術的な要点は次の 3 つ（詳細は [research.md](./research.md)）。

1. **通信をボード画面に閉じ込める**: `adsbygoogle.js` は `index.html` に書かず、ボード画面を初めて表示して
   描画が終わったあとに動的に読み込む。ほかの画面では広告の枠を DOM から外す（R3）。
2. **ボタンを隠さない**: 高さの決まった 320×50 のユニットを使い、帯が出ているあいだだけ CSS 変数 `--ad-inset` で
   ボード画面の下余白とトーストの位置を上げる。シートは帯より手前に重ねる（R1, R5）。
3. **設定がなければ何もしない**: パブリッシャー ID・広告ユニット ID はビルド時の環境変数で渡し、未設定のビルドは
   今と同じく外部通信ゼロ。テストは広告ありのビルドとスタブで行う（R2, R10）。

同意の取得は AdSense の Google 認定 CMP に任せ、外部送信の公表は静的ページ `privacy.html` で行う（R6）。

## Technical Context

**Language/Version**: TypeScript（strict）、Vite、Node.js 24（001 と同じ）

**Primary Dependencies**: 追加なし。実行時は Preact・@preact/signals・idb のまま。外部の `adsbygoogle.js` は
npm の依存ではなく、実行時に Google から読み込むスクリプト

**Storage**: 変更なし（保存データは増えない。[data-model.md](./data-model.md)）

**Testing**: Vitest + happy-dom（枠の状態遷移・表示する画面の判定）、Playwright の Chromium・WebKit
（広告ありのビルドを 2 つ目の `webServer` で起動し、`page.route` で AdSense をスタブ化）

**Target Platform**: 001 と同じ（最新の iOS Safari、Android Chrome、デスクトップの Chrome・Edge・Safari）。
GitHub Pages の `/photo-bucket/`

**Project Type**: クライアントのみの Web アプリ（PWA）

**Performance Goals**: 広告を追加してもボードのマス目が表示されるまでの時間の増加が 0.1 秒未満（SC-002）

**Constraints**: ボード画面以外で外部通信しない。オフラインでは広告を出さずキャッシュもしない。帯の高さは画面の高さの
15%（低い画面で 20%）以下。初回読み込みの JS は gzip 60KB 以下を維持（広告の読み込み処理は 1KB 程度）

**Scale/Scope**: 画面 1 つに帯 1 つ。新しいファイルは `src/ads/` の 2〜3 個と `public/privacy.html`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

憲章 v1.2.0 に対して確認する。

| 原則 | 確認内容 | 設計前 | 設計後 |
|---|---|---|---|
| I. ローカルファースト & プライバシー | 外部通信はボード画面の広告配信サービスだけ（R3）。ボードの内容・写真は送らず、`document.title` も変えない（data-model.md）。読み込み失敗・ブロック・オフラインでも他の機能に影響しない（R4）。同意は Google 認定 CMP、外部送信の説明は `privacy.html`（R6）。**既知の制約**: 読み込み済みの `adsbygoogle.js` がボード画面を離れたあとに通信する可能性（R3）を E2E で監視する | ✅ | ✅（制約を監視付きで許容） |
| II. 静的ホスティング前提 | 静的ファイルのみ。ID はビルド時の環境変数。`privacy.html` もサブパスで配信。`ads.txt` はドメイン直下の別リポジトリに置く（R9、コード外の前提） | ✅ | ✅ |
| III. オフライン対応 PWA | 広告以外の全機能はオフラインで動く。広告は `runtimeCaching` に含めずキャッシュしない（R7）。`privacy.html` は precache | ✅ | ✅ |
| IV. モバイルファースト & アクセシビリティ | 360px 幅で 320×50 が収まる。帯でボタンを隠さない（`--ad-inset`）。`aside aria-label="広告"`、フォーカス順は操作ボタンの後、シート中は `inert`（contracts/ad-banner.md） | ✅ | ✅ |
| V. シンプルさ & 最小依存 | npm の依存を増やさない。ルーターの変更なし。広告機能は `src/ads/` に閉じ込める | ✅ | ✅ |
| VI. データの可搬性と画像出力の忠実性 | 保存画像はデータから Canvas に描くため広告は入らない（R8）。スキーマ・バックアップ形式は変更なし | ✅ | ✅ |

**開発ワークフロー**: マージ前に GitHub Pages 相当のサブパスで、オフライン動作とインストール可能性を確認する（quickstart.md）。

違反なし。Complexity Tracking は不要。

## Project Structure

### Documentation (this feature)

```text
specs/002-board-banner-ad/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── ad-banner.md     # 帯広告の表示・配置・通信・設定・プライバシーポリシー
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── ads/                      # 新規: 帯広告
│   ├── config.ts             # VITE_ADSENSE_CLIENT / SLOT を検証して AdConfig を返す（R2）
│   ├── loader.ts             # adsbygoogle.js の動的読み込み（1 回だけ）とエラー検知（R3, R4）
│   └── AdBanner.tsx          # 枠・状態遷移（idle/loading/shown/hidden）・--ad-inset の設定（R4, R5）
├── app/
│   └── App.tsx               # 変更: ルートが board / cell のとき <AdBanner> を置く。cell では inert
├── ui/screens/
│   └── BoardList.tsx         # 変更: 下部に「プライバシーポリシー」リンク
├── styles/base.css           # 変更: .ad-banner、--ad-inset を .app と .toasts に反映
└── vite-env.d.ts             # 新規: ImportMetaEnv に VITE_ADSENSE_* の型

public/
└── privacy.html              # 新規: プライバシーポリシー（R6、contracts/ad-banner.md）

tests/
├── unit/
│   ├── ad-config.test.ts     # 新規
│   └── ad-banner.test.tsx    # 新規: 状態遷移、表示する画面、--ad-inset
└── e2e/
    ├── ads-helpers.ts        # 新規: AdSense のスタブ（filled / unfilled / 404）
    ├── ads-banner.spec.ts    # 新規
    ├── ads-failure.spec.ts   # 新規
    ├── ads-privacy.spec.ts   # 新規
    └── a11y.spec.ts          # 変更: 広告ありのボード画面を追加

playwright.config.ts          # 変更: 広告ありビルド（dist-ads/, :4174）の webServer と ads-* 用プロジェクト
.github/workflows/deploy.yml  # 変更: vars.ADSENSE_CLIENT / ADSENSE_SLOT をビルドに渡す
```

**Structure Decision**: 001 と同じ単一プロジェクト構成。広告に関わるコードは `src/ads/` にまとめ、既存の画面は
`App.tsx` での配置と `BoardList.tsx` のリンク追加だけにとどめる。ルート（`router.ts`）とデータ層は変更しない。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

違反なし。
