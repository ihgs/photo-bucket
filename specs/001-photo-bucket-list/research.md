# Research: 写真型バケットリスト

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-23

Technical Context の未確定事項と主要な技術選択について、決定・理由・検討した代替案をまとめる。

## R1. 言語とビルドツール

- **Decision**: TypeScript + Vite（実装時点の最新安定版）でビルドし、静的ファイル（`dist/`）を出力する。
- **Rationale**: devcontainer が Node.js 24 / TypeScript 環境である。Vite は `base` 設定でサブパス配信
  （`/<repo>/`）に対応し、GitHub Pages 向け静的出力が容易（憲章 II）。型によりデータモデルと
  バックアップ形式の整合を保ちやすい。
- **Alternatives considered**:
  - ビルドなしの素の ES Modules: 依存は最小だが、PWA の precache マニフェスト生成とハッシュ付き
    ファイル名を手作業で管理する必要があり、更新時のキャッシュ不整合リスクが高い。
  - webpack / Parcel: 設定量が多い、または PWA プラグインの成熟度で Vite に劣る。

## R2. UI フレームワーク

- **Decision**: Preact 10（+ `@preact/signals`）を使う。
- **Rationale**: ボード一覧、マス編集シート、写真の切り抜き調整、保存ダイアログなど状態を持つ画面が
  複数あり、素の DOM 操作では状態と表示の同期が複雑になる。Preact は約 4KB（gzip）で、
  憲章 V の「最小依存・小さなバンドル」と両立する。JSX はテキストを自動エスケープするため、
  `innerHTML` 直挿入禁止（憲章 技術的制約）を自然に守れる。
- **Alternatives considered**:
  - React: 機能は同等だがバンドルが約 10 倍。
  - Lit / Web Components: 軽量だが、フォームや状態管理の記述が冗長になる。
  - フレームワークなし: 依存ゼロだが、画面数と状態遷移を考えると保守負担が大きい。

## R3. 端末内ストレージ

- **Decision**: IndexedDB を `idb`（約 1KB の Promise ラッパー）経由で使う。写真は ArrayBuffer として
  （Safari のプライベートブラウズでは Blob を保存できないため。data-model.md「Photo」参照）
  `photos` ストアに、ボード（マスを含む）は `boards` ストアに分けて保存する。起動時に
  `navigator.storage.persist()` を要求し、`navigator.storage.estimate()` で残り容量を確認する。
- **Rationale**: 写真を base64 化せずにバイナリのまま保存でき容量効率が良い（憲章 I・技術的制約）。
  ボードと写真を分けることで、一覧表示時に写真本体を読み込まずに済む（SC-006）。
  `idb` は IndexedDB のイベント API を Promise 化するだけの薄い層で、自前実装よりバグの余地が少ない。
- **Alternatives considered**:
  - localStorage: 容量が約 5MB で写真を保存できない。
  - 素の IndexedDB API: 依存ゼロだが、トランザクションとイベント処理の定型コードが多い。
  - Dexie.js: 高機能だが約 25KB で、本機能には過剰。

## R4. 写真の取り込み（カメラ・ライブラリ・大きな写真）

- **Decision**: `<input type="file" accept="image/*">`（ライブラリ用）と
  `<input type="file" accept="image/*" capture="environment">`（カメラ用）の 2 ボタンを用意する。
  読み込んだ画像は `createImageBitmap(file, { imageOrientation: "from-image" })` でデコードし、
  長辺 1600px 以下に縮小して JPEG（品質 0.85）として再エンコードして保存する。
- **Rationale**: 追加権限不要でカメラとライブラリの両方に対応できる（憲章 IV, FR-007）。
  Canvas で描き直すことで EXIF（位置情報を含む）は保存データからも除去される（FR-015）。
  1600px は、最大の出力マス（3×3 で 800px 四方）を 2 倍拡大しても画質を保てる大きさ。
  iOS は HEIC を選んでも `image/*` 指定時に JPEG へ変換して渡すため、別途デコーダは不要。
- **Alternatives considered**:
  - `getUserMedia` による独自カメラ画面: 権限ダイアログと UI 実装が増え、端末標準カメラより劣る。
  - 原寸のまま保存: 5000 万画素写真 25 枚で数百 MB となり容量超過の危険が大きい。

## R5. 写真の切り抜き（表示範囲）の表現

- **Decision**: 写真ごとに `crop = { cx, cy, zoom }` を保存する。`cx, cy` は写真内の表示中心を
  0〜1 の相対座標で、`zoom` は「マスを覆う最小倍率」を 1 とした拡大率（1〜4）で表す。
  初期値は `{ cx: 0.5, cy: 0.5, zoom: 1 }`（中央・カバー表示）。
- **Rationale**: 解像度に依存しない表現にすることで、画面表示（数十 px のマス）と保存画像
  （数百 px のマス）で同じ切り抜き結果を得られる（FR-014, SC-004）。マスは常に正方形なので
  縦横比の情報は不要。
- **Alternatives considered**: ピクセル単位のオフセット保存 — 表示サイズごとに換算が必要で
  画面と出力のずれの原因になる。

## R6. 画面表示と保存画像の一致

- **Decision**: ボードの幾何計算（マス位置、余白、角丸、文字サイズ、テキストの折り返し結果）を
  純粋関数の `layoutBoard(board, width)` に集約する。画面（DOM）と保存画像（Canvas 2D）の
  両レンダラーはこの結果だけを使って描画する。テキストの折り返しは Canvas の `measureText` で
  計算し、DOM 側も同じ行分割結果を表示する。フォントは端末の標準ゴシック体を DOM と Canvas で
  同じ `font-family` 指定で使い、フォント読み込み完了（`document.fonts.ready`）を待ってから計測する。
- **Rationale**: 2 つの描画経路で計算を重複させないことが、見た目の不一致を防ぐ最も確実な方法
  （憲章 VI）。行分割を共有するため、ブラウザごとの CSS 折り返しの差も出ない。
  計測と描画は同じ端末で行うので、端末標準フォントでも画面と保存画像は一致する。
- **Alternatives considered**:
  - 日本語 Web フォントの同梱: 端末間で見た目がそろうが数 MB になり、憲章 V（小さなバンドル）に反する。
  - DOM をそのまま画像化するライブラリ（html2canvas 等）: 依存が大きく、iOS Safari での
    再現性に問題がある。
  - 画面も Canvas で描画: 一致は保証できるが、タップ操作・アクセシビリティ（読み上げ）が損なわれる。

## R7. 保存画像の仕様

- **Decision**: 出力サイズはボードの縦横比で固定する — 1:1 は 2400×2400、縦 3:4 は 1800×2400、
  横 4:3 は 2400×1800（いずれも長辺 2400px）。形式は JPEG（品質 0.92）を既定とする。
  タイトルを入れる場合は、マス目の上端に半透明の帯を重ね、その上に白文字で描画する
  （影付きで、写真の明るさに関係なく読める）。
- **Rationale**: FR-013（縦横比を正確に一致）と FR-016（長辺 2000px 以上）を満たす。
  写真主体の画像は PNG だと 10MB を超えうるため JPEG を既定とする。
- **Alternatives considered**: PNG — 文字はくっきりするがファイルサイズが大きく、SNS 側で再圧縮される。

## R8. 保存・共有

- **Decision**: Canvas から Blob を生成し、`navigator.canShare({ files })` が真なら
  Web Share API（`navigator.share({ files })`）で共有メニューを開く。そうでなければ
  `<a download>` でダウンロードする。「保存」と「共有」は同じ仕組みを使い、スマホでは
  共有メニューから「画像を保存」を選ぶ案内を出す。
- **Rationale**: iOS のホーム画面起動（standalone）では `<a download>` が不安定なため、
  共有メニュー経由が最も確実に写真アプリへ保存できる（FR-017）。
- **Alternatives considered**: File System Access API — iOS / Android で未対応。

## R9. PWA（オフライン・インストール・更新）

- **Decision**: `vite-plugin-pwa`（Workbox の generateSW）で Service Worker と Web App Manifest を
  生成する。アプリ本体・フォント・アイコンをすべて precache する。`registerType: "prompt"` とし、
  新しいバージョンがあれば画面下部に「更新」ボタンを出す。
- **Rationale**: 初回読み込み後のオフライン動作（FR-020）を、ハッシュ付きファイルの precache で
  確実に実現する。ユーザーデータは IndexedDB にあり Service Worker のキャッシュとは独立しているため、
  更新してもデータは消えない（FR-022）。prompt 方式は編集中の突然の再読み込みを避けられる。
- **Alternatives considered**:
  - 手書きの Service Worker: 依存は減るが precache リストとキャッシュ無効化を手作業で管理することになる。
  - `autoUpdate`: 編集中にページが再読み込みされうる。

## R10. 画面遷移（ルーティング）

- **Decision**: ハッシュベースのルーティング（`#/`、`#/boards/:id` など）を自前の小さな関数で実装する。
- **Rationale**: GitHub Pages は SPA 用の 404 フォールバックを持たないため、パス形式のルーティングでは
  直接アクセスやリロードで 404 になる（憲章 II）。画面数が少ないためルーターライブラリは不要（憲章 V）。
- **Alternatives considered**: `404.html` リダイレクトの工夫 — 動作するがオフライン時や
  Service Worker との組み合わせで複雑になる。

## R11. バックアップ形式

- **Decision**: 1 つの JSON ファイル（拡張子 `.photobucket.json`）に、形式バージョン、ボード、
  写真（base64 の data URL）をまとめる。読み込み時はスキーマを検証し、問題があれば何も書き込まずに
  エラーを表示する。同じ ID のボードがあれば「上書き」か「別のボードとして追加」を選ばせる。
- **Rationale**: 依存ライブラリなしで読み書きでき、形式も目で確認しやすい。写真は縮小済み
  （長辺 1600px）なので 25 枚でも 15MB 程度に収まる。
- **Alternatives considered**: ZIP — サイズ効率は良いが圧縮ライブラリが必要（JPEG はほぼ圧縮されない）。

## R12. テスト

- **Decision**:
  - 単体・結合テスト: Vitest + happy-dom、IndexedDB は `fake-indexeddb`、コンポーネントは
    `@testing-library/preact`。
  - E2E: Playwright（Chromium と WebKit）で、サブパス配信した本番ビルドに対して、
    主要フロー、オフライン動作（`context.setOffline(true)`）、保存画像の寸法と見た目を検証する。
- **Rationale**: 憲章の品質ゲート（データモデル・スキーマ移行、画像出力ロジック、保存・読み込みの
  自動テスト、サブパスでのオフライン確認）をすべて自動化できる。WebKit で iOS Safari に近い挙動を確認する。
- **Alternatives considered**: Jest — Vite との設定共有で Vitest に劣る。

## R13. デプロイ

- **Decision**: GitHub Actions で `main` への push 時に lint・テスト・ビルドを実行し、
  `actions/upload-pages-artifact` と `actions/deploy-pages` で公開する。Vite の `base` は
  環境変数 `BASE_PATH`（既定 `/photo-bucket/`）で指定する。
- **Rationale**: 憲章 II の「再現可能なビルド成果物からデプロイ」を満たす。
- **Alternatives considered**: `gh-pages` ブランチへの手動 push — 再現性が低い。
