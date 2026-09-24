---

description: "Task list for 写真型バケットリスト"
---

# Tasks: 写真型バケットリスト

**Input**: Design documents from `/specs/001-photo-bucket-list/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/（backup-format.md, export-image.md, ui-routes.md）, quickstart.md

**Tests**: 憲章「開発ワークフローと品質ゲート」で、データモデルとスキーマ移行・画像出力のロジック・ストレージの保存と読み込みの自動テストが必須とされているため、それらのテストタスクを含める。E2E は quickstart.md のシナリオ 1〜6 に対応させる。テストは実装より先に書き、失敗することを確かめてから実装する。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- 単一のフロントエンドプロジェクト。`src/`、`tests/` はリポジトリ直下（plan.md「Project Structure」）
- 画面の文言はすべて日本語（FR-027）。テキストは JSX で描画し、`innerHTML`・`dangerouslySetInnerHTML` は使わない（憲章 技術的制約）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: プロジェクトの初期化と基本構成

- [X] T001 リポジトリ直下に `package.json` を作成する（`"type": "module"`、`private: true`）。実行時依存に `preact`、`@preact/signals`、`idb`、開発依存に `vite`、`@preact/preset-vite`、`typescript`、`vite-plugin-pwa`、`vitest`、`happy-dom`、`fake-indexeddb`、`@testing-library/preact`、`@playwright/test`、`eslint`、`typescript-eslint`、`prettier` を追加し、`npm install` を実行する。scripts に `dev`（vite）、`build`（`tsc --noEmit && vite build`）、`preview`（`vite preview --base /photo-bucket/`）、`lint`（`tsc --noEmit && eslint .`）、`test`（`vitest run`）、`test:e2e`（`playwright test`）を定義する
- [X] T002 `tsconfig.json` を作成する（`strict: true`、`jsx: "react-jsx"`、`jsxImportSource: "preact"`、`moduleResolution: "bundler"`、`target: "ES2022"`、`lib: ["ES2022", "DOM", "DOM.Iterable"]`、`types: ["vite/client", "vite-plugin-pwa/client"]`）
- [X] T003 `vite.config.ts` を作成する。`base` は `process.env.BASE_PATH ?? "/photo-bucket/"`、プラグインは `@preact/preset-vite`。Vitest の設定（`environment: "happy-dom"`、`setupFiles: ["tests/setup.ts"]`、`include: ["tests/unit/**/*.test.ts?(x)", "tests/integration/**/*.test.ts?(x)"]`）も同じファイルに書く
- [X] T004 [P] `tests/setup.ts` を作成し、`import "fake-indexeddb/auto"` と、`crypto.randomUUID` がない環境向けの補完を行う
- [X] T005 [P] `eslint.config.js`（typescript-eslint の推奨設定。`no-restricted-properties` で `innerHTML` への代入を禁止）と `.prettierrc` を作成し、`.gitignore` に `node_modules/`、`dist/`、`test-results/`、`playwright-report/` を追加する
- [X] T006 [P] `index.html` を作成する（`lang="ja"`、`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`、`<div id="app">`、`/src/main.tsx` の読み込み）
- [X] T007 [P] `playwright.config.ts` を作成する。`webServer` で `npm run build && npm run preview -- --port 4173 --strictPort` を起動し、`baseURL` は `http://localhost:4173/photo-bucket/`。projects は `chromium`（Pixel 7 相当のモバイル）と `webkit`（iPhone 14 相当）。`testDir: "tests/e2e"`
- [X] T008 [P] `.github/workflows/deploy.yml` を作成する。`main` への push と手動実行で、Node 24 をセットアップ → `npm ci` → `npm run lint` → `npm test` → `npx playwright install --with-deps chromium webkit` → `npm run test:e2e` → `BASE_PATH=/photo-bucket/ npm run build` → `actions/upload-pages-artifact`（`dist`）→ `actions/deploy-pages`。`permissions` に `pages: write`、`id-token: write` を付ける

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのユーザーストーリーが使う型、データベース、レイアウト計算、画面の骨組み

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T009 `src/domain/types.ts` に data-model.md の型を定義する。`GridSize = { cols: number; rows: number }`、`Category = "want" | "go" | "eat" | "other"`、`Crop = { cx: number; cy: number; zoom: number }`（「`cx` 0〜1」「`cy` 0〜1」「`zoom` 1〜4」）、`Cell`（`id`, `row`, `col`, `title`, `category`, `memo?`, `photoId?`, `crop?`, `achievedAt?`）、`Board`（`id`, `title`, `size`, `cells`, `createdAt`, `updatedAt`）、`Photo`（`id`, `boardId`, `blob`, `width`, `height`, `thumbBlob`）、`Preferences`（`exportIncludeTitle: boolean` 既定 `true`、`lastBackupAt: string | null` 既定 `null`、`lastOpenedBoardId: string | null` 既定 `null`）。カテゴリの表示名「やりたい」「行きたい」「食べたい」「その他」と色も定数で持つ
- [X] T010 [P] `tests/unit/grid.test.ts` に `src/domain/grid.ts` のテストを書く: 5 種類のサイズだけが有効（3×3, 4×4, 5×5, 3×4=cols 3・rows 4, 4×3=cols 4・rows 3）、それ以外（例 6×6, 2×3）は無効、表示名は「横の列数×縦の行数」、達成数は `photoId` を持つマスの数、総数は `cols × rows`
- [X] T011 `src/domain/grid.ts` を実装する: `GRID_SIZES`（5 種類と表示名）、`isValidGridSize`、`gridLabel`、`aspectRatio(size)`（1:1・3:4・4:3）、`countAchieved(board)`、`findCell(board, row, col)`。T010 を通す
- [X] T012 [P] `tests/unit/validation.test.ts` に `src/domain/validation.ts` のテストを書く: ボードの `title` は「1〜40 文字（前後の空白は除去）。空なら「無題のボード」」、マスの `title` は「1〜60 文字」、`memo` は「0〜500 文字」、`category` は want/go/eat/other のみ、`row`/`col` は「`0 ≤ row < size.rows`」「`0 ≤ col < size.cols`」で「同じ位置の重複なし」、`photoId` があれば `crop` と `achievedAt` が必須
- [X] T013 `src/domain/validation.ts` を実装する: `normalizeBoardTitle`、`validateCellInput`、`validateBoard`（エラー理由を日本語で返す）。T012 を通す。バックアップ読み込み（US5）でも再利用する
- [X] T014 [P] `tests/unit/db.test.ts` に `src/storage/db.ts` のテストを書く（fake-indexeddb）: データベース名 `photo-bucket`、ストア `boards`（keyPath `id`）、`photos`（keyPath `id`、インデックス `byBoard` = `boardId`）、`meta`。初回オープンで `meta` の `"schemaVersion"` が `1` になる。移行関数の配列が保存済みバージョンから順に適用される（テスト用のダミー移行 v1→v2 で確かめる）
- [X] T015 `src/storage/db.ts` を実装する: `idb` の `openDB` で上記ストアを作成し、`MIGRATIONS: Array<(db, tx) => void>` を `oldVersion` から順に実行、`meta` の `"schemaVersion"` を更新する。`getDb()` で接続を 1 つだけ共有する。`QuotaExceededError` を `StorageFullError` に変換するヘルパー `withQuotaGuard` を用意する。T014 を通す
- [X] T015a `src/storage/photos.ts` に写真の削除だけを先に実装する: `deletePhotos(ids: string[])`（1 トランザクションで削除。Board の保存と同じトランザクションに参加できるよう、トランザクションを引数で受け取れるようにする）と `deletePhotosOfBoard(boardId)`（インデックス `byBoard` を使う）。テストを `tests/integration/photos-storage.test.ts` に書く
- [X] T016 [P] `tests/integration/boards-storage.test.ts` に `src/storage/boards.ts` のテストを書く: 作成 → 取得 → 更新（`updatedAt` が進む）→ 一覧（`updatedAt` の新しい順）→ 削除。削除時に `photos` の同じ `boardId` の写真も消える。容量不足を模した失敗では既存データが変わらない
- [X] T017 `src/storage/boards.ts` を実装する: `createBoard(title, size)`（`crypto.randomUUID()`、空の `cells`、`createdAt`/`updatedAt`）、`getBoard`、`listBoards`（写真本体は読まない）、`saveBoard`（`updatedAt` を更新）、`deleteBoard`（Board の削除と T015a の `deletePhotosOfBoard` を 1 トランザクションで実行）。T016 を通す
- [X] T018 [P] `src/storage/preferences.ts` を実装する: `meta` ストアのキー `"preferences"` を読み書きする `getPreferences()`（未保存なら既定値）と `updatePreferences(partial)`
- [X] T019 [P] `tests/unit/layout.test.ts` に `src/domain/layout.ts` のテストを書く: 5 種類のサイズで、マスが正方形・マス間の余白が同じ幅で外周はその半分（正方形と縦横比ちょうどを両立させるため）・全体の縦横比がボードと一致（3×4 は幅:高さ = 3:4）。同じボードを幅 360 と幅 2400 で計算すると、各マスの位置と大きさが幅に比例し、文字の行分割結果が同じ。60 文字のタイトルがマスからはみ出さず、最大行数を超えると末尾が「…」になる。`includeTitle: true` でタイトル帯がマス目の上端に重なり、全体の寸法は変わらない。タイトル帯の色の設定値（黒・不透明度 55%）で、真っ白と真っ黒の背景に合成したときの白文字とのコントラスト比がどちらも 4.5 以上になる（FR-013a）
- [X] T020 `src/domain/layout.ts` を実装する（research.md R6）: `layoutBoard(board, { width, includeTitle, measure })` が、全体の `width`/`height`、各マスの矩形（`x, y, size`）、文字サイズ、行分割済みのテキスト、カテゴリ帯、タイトル帯の矩形を返す純粋関数。文字幅の計測は引数 `measure(text, fontPx) => number` で受け取り、寸法はすべて `width` に対する比率で決める（`width` を変えても行分割が変わらないよう、行分割は基準幅 1000 で計算して拡大縮小する）。フォントは DOM と Canvas で共通の定数 `FONT_FAMILY`（端末標準のゴシック体: `system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`）を使う。T019 を通す
- [X] T021 [P] `src/domain/measure.ts` を実装する: `OffscreenCanvas`（なければ `<canvas>`）の `measureText` を使う `createCanvasMeasure()`。呼び出し前に `document.fonts.ready` を待つ `ready()` を用意する
- [X] T022 [P] `src/app/router.ts` を実装する（contracts/ui-routes.md）: `location.hash` を解析して `{ name: "list" } | { name: "new" } | { name: "board", boardId } | { name: "cell", boardId, row, col } | { name: "crop", boardId, row, col } | { name: "export", boardId } | { name: "settings", boardId }` を返す `parseRoute`、`navigate(route)`、`hashchange` を購読する signal `currentRoute`。不正な形式は `list` にする。単体テストを `tests/unit/router.test.ts` に書く
- [X] T023 `src/app/App.tsx` と `src/main.tsx` を実装する: `currentRoute` に応じて画面を切り替える（未実装の画面は仮表示）。共通のトースト表示の仕組み `src/ui/components/Toast.tsx`（`showToast(message)`）を置き、`StorageFullError` を受けたら「端末の保存容量が足りません」と表示する。存在しない `boardId` や範囲外の `row`/`col` は `#/` に戻して「ボードが見つかりません」と表示する
- [X] T024 [P] `src/styles/base.css` を作成する: 360px 幅基準のモバイルファースト、`env(safe-area-inset-*)` の余白、ボタンのタップ領域 44×44px 以上、フォーカスの見える枠、カテゴリ 4 色（文字とのコントラスト 4.5:1 以上）。`src/main.tsx` で読み込む
- [X] T025 [P] `src/ui/components/ConfirmDialog.tsx` を実装する: `<dialog>` を使った確認ダイアログ（タイトル、本文、「キャンセル」「実行」ボタン、Esc で閉じる、フォーカスを閉じ込める）。`confirm(options): Promise<boolean>` で呼べるようにする

**Checkpoint**: 基盤が完成。ここからユーザーストーリーの実装に入れる

---

## Phase 3: User Story 1 - マス目にやりたいことを書き込む (Priority: P1) 🎯 MVP

**Goal**: マス目サイズを選んでボードを作り、マスに項目（タイトル・カテゴリ・メモ）を書き込み、編集・削除・入れ替えができる。再読み込みしても残る

**Independent Test**: 5×5 と 3×4 のボードを作って数マスに項目を書き込み、再読み込みしても同じ内容が表示される（quickstart.md シナリオ 1）

### Tests for User Story 1

- [X] T026 [P] [US1] `tests/unit/grid-edit.test.ts` に `src/domain/grid.ts` の編集関数のテストを書く: `upsertCell` で空マスに追加・既存マスを更新（`id` は維持）、`removeCell`、`swapCells`（両方埋まっていれば `row`/`col` を交換、片方が空なら移動。写真・`crop`・`achievedAt` はそのまま）、`resizeBoard`（範囲外のマスの一覧を返す `cellsOutside(board, newSize)` と、範囲外を除いて `size` を更新する処理。範囲内のマスは同じ `row`/`col` のまま）
- [X] T027 [P] [US1] `tests/e2e/us1-board.spec.ts` に E2E を書く: 最初のボードを作る → 3×4 を選ぶ → 横 3 列・縦 4 行で縦長のボードが表示される → マスに「京都で抹茶パフェを食べる」・カテゴリ「食べたい」を入力 → マスにタイトルとカテゴリ名が表示される → 再読み込みしても残る → 項目を削除すると空マスに戻る

### Implementation for User Story 1

- [X] T028 [US1] `src/domain/grid.ts` に `upsertCell`、`removeCell`、`swapCells`、`cellsOutside`、`resizeBoard` を追加する（ボードを直接書き換えず新しいオブジェクトを返す）。T026 を通す
- [X] T029 [US1] `src/ui/state/boardStore.ts` を実装する: 開いているボードを持つ signal と、編集操作（`updateTitle`、`upsertCell`、`removeCell`、`swapCells`、`resize`）。`removeCell` と `resize` は、削除するマスに `photoId` があれば、Board の保存と同じトランザクションで `deletePhotos`（T015a）も実行する（data-model.md「状態遷移」）。操作のたびに `saveBoard` で自動保存する（FR-019）。保存失敗時は画面の状態を保存前に戻し、トーストで知らせる
- [X] T030 [P] [US1] `src/ui/components/CategoryBadge.tsx` を実装する: カテゴリの色と表示名（色だけに頼らず文字も出す）
- [X] T031 [US1] `src/ui/components/GridView.tsx` と `src/ui/components/CellTile.tsx` を実装する: `layoutBoard` の結果（`measure` は T021）で各マスを絶対配置し、未達成のマスはカテゴリ帯・カテゴリ名・行分割済みのタイトルを表示、空マスは「＋」のみ。各マスは `<button>` で、読み上げラベルは「3行2列 京都で抹茶パフェを食べる 未達成」の形式。画面幅に合わせて横スクロールなしで全体を表示する（FR-026）
- [X] T032 [US1] `src/ui/screens/NewBoard.tsx`（`#/new`）を実装する: タイトル入力（「1〜40 文字」、空なら「無題のボード」）と、5 種類のマス目サイズを縦横比の小さな図つきで選ぶボタン（既定 5×5）。作成後 `#/boards/:id` へ移動する
- [X] T033 [US1] `src/ui/screens/BoardList.tsx`（`#/`）の最小版を実装する: ボードがなければ「最初のボードを作る」ボタンのみ、あれば一覧（タイトル・マス目サイズ・達成数）を `updatedAt` の新しい順に表示してタップで開く。ボードを開くたびに `Preferences.lastOpenedBoardId`（「最後に開いたボードの ID。アプリ起動時に最初の 1 回だけ、このボードを開く」）を更新し、アプリを起動した最初の 1 回だけそのボードを開く。あとで一覧に戻ったときは開かない（ui-routes.md）
- [X] T034 [US1] `src/ui/screens/BoardView.tsx`（`#/boards/:id`）を実装する: ボードのタイトル、`GridView`、達成数「7/25 達成」（FR-012）、設定ボタン。マスをタップすると `#/boards/:id/cells/:row/:col` へ移動する
- [X] T035 [US1] `src/ui/screens/CellSheet.tsx`（`#/boards/:id/cells/:row/:col`、下から出るシート）の項目編集部分を実装する: タイトル（必須、「1〜60 文字」）、カテゴリ 4 つの選択（既定「やりたい」）、メモ（「0〜500 文字」）。入力のたびに自動保存し、「項目を削除」は確認ダイアログのあとに実行する（写真付きなら「写真も削除されます」と表示）
- [X] T036 [US1] `src/ui/screens/BoardView.tsx` に移動モードを追加する（FR-005）: 「移動」ボタンで移動モードに入り、移動元 → 移動先の順にタップすると `swapCells` を実行。移動元は枠で強調し、「移動元を選んでください」「移動先を選んでください」を表示する。「完了」で終了
- [X] T037 [US1] `src/ui/screens/BoardSettings.tsx`（`#/boards/:id/settings`）を実装する: タイトル変更（FR-002）、マス目サイズの変更（FR-006）。変更で範囲外になるマスがあれば「N 件の項目（うち写真付き M 件）が削除されます」と確認し、承認されたら `boardStore.resize` を呼ぶ（範囲外のマスと写真の削除は T029 が行う）
- [X] T038 [US1] 長い項目名（60 文字）を 5×5 のマスに入れたとき、画面でマスからはみ出さず「…」で省略されることを `tests/integration/grid-view.test.tsx`（@testing-library/preact）で確かめる

**Checkpoint**: User Story 1 が単独で動く。ボードを作って項目を書き、再読み込みしても残る

---

## Phase 4: User Story 2 - 達成したマスに写真を貼る (Priority: P1)

**Goal**: 項目の入ったマスに撮影またはライブラリの写真を貼って達成済みにし、表示範囲の調整・差し替え・取り外しができる

**Independent Test**: 項目の入ったマスに写真を貼ると、写真付きの達成済み表示になり達成数が 1 増える。位置情報付きの写真でも保存データに位置情報が残らない（quickstart.md シナリオ 2）

### Tests for User Story 2

- [X] T039 [P] [US2] `tests/unit/crop.test.ts` に `src/domain/crop.ts` のテストを書く: `zoom` は「1〜4」に制限、`cx`/`cy` は「0〜1」かつ表示範囲が写真の外にはみ出さないよう `zoom` に応じて制限、初期値は `{ cx: 0.5, cy: 0.5, zoom: 1 }`。`sourceRect(photoW, photoH, crop)` が縦長・横長・正方形の写真で正方形の切り出し矩形（元画像の px 座標）を返し、`zoom: 1` のときは短辺いっぱいの中央の正方形になる
- [X] T040 [P] [US2] `tests/integration/photos-storage.test.ts`（T015a で作成済み）に `src/storage/photos.ts` のテストを追加する: 写真の保存と取得、`byBoard` による一括取得、写真の削除。マスへの貼り付け・差し替え・取り外しで Board と Photo が 1 トランザクションで整合する（取り外すと `photoId`・`crop`・`achievedAt` が消えて Photo も削除され、差し替えでは `achievedAt` が変わらない）
- [X] T041 [P] [US2] `tests/e2e/us2-photo.spec.ts` に E2E を書く: 項目の入ったマスで「ライブラリから選ぶ」の file input に `tests/e2e/fixtures/gps-photo.jpg`（GPS の EXIF を含む縦長のテスト画像。無ければ作成して置く）を設定 → マスに写真が表示され達成数が 1 増える → IndexedDB から取り出した Blob の先頭に EXIF の APP1（`Exif`）セグメントがない → 写真を外すと未達成に戻り達成数が減る

### Implementation for User Story 2

- [X] T042 [US2] `src/domain/crop.ts` を実装する: `DEFAULT_CROP`、`clampCrop(crop, photoW, photoH)`、`sourceRect(photoW, photoH, crop)`。T039 を通す
- [X] T043 [US2] `src/media/importPhoto.ts` を実装する（research.md R4）: `createImageBitmap(file, { imageOrientation: "from-image" })` でデコードし、長辺 1600px 以下に縮小して JPEG（品質 0.85）の本体と、長辺 320px のサムネイルを Canvas から生成して `{ blob, thumbBlob, width, height }` を返す。画像として読めない場合は「この写真は読み込めませんでした」のエラーを投げる
- [X] T044 [US2] T015a の `src/storage/photos.ts` に追加で実装する: `attachPhoto(boardId, row, col, imported)`（Photo を追加し、マスに `photoId`・`DEFAULT_CROP`・`achievedAt`（未設定なら現在時刻）を設定。差し替え時は古い Photo を削除して `achievedAt` を維持）、`detachPhoto`、`getPhoto`、`getThumbUrl`（`URL.createObjectURL` をキャッシュし、不要になったら解放）。すべて `withQuotaGuard` を通す。T040 を通す
- [X] T045 [US2] `src/ui/screens/CellSheet.tsx` に写真の操作を追加する（FR-007, FR-010, FR-011）: 項目が入っているときだけ「撮影する」（`<input type="file" accept="image/*" capture="environment">`）と「ライブラリから選ぶ」（`<input type="file" accept="image/*">`）を表示。写真があれば写真・達成日（例「2026年9月23日 達成」）・「表示範囲を調整」「写真を差し替える」「写真を外す」（確認つき）を表示する。取り込み中は進行表示を出す
- [X] T046 [US2] `src/ui/components/CellTile.tsx` に達成済みの表示を追加する（FR-008）: サムネイルを `sourceRect` に従って CSS（`object-view-box` は使わず、`background-size`/`background-position` か `transform` で）切り抜いて表示し、下部に半透明の帯と白文字でタイトルを重ねる。読み上げラベルは「… 達成済み」にする。表示位置の計算は `layoutBoard` と `sourceRect` の結果だけを使う
- [X] T047 [US2] `src/ui/screens/CropEditor.tsx`（`#/boards/:id/cells/:row/:col/crop`）を実装する（FR-009）: 正方形の枠内で写真をドラッグして位置、ピンチまたはスライダー（1〜4）で拡大率を変える。キーボードでは矢印キーで位置、`+`/`-` で拡大率を変えられる。値は `clampCrop` で制限し、「完了」で保存する
- [X] T048 [US2] 画像以外のファイルや壊れた写真を選んだとき、マスを変えずにエラーを表示することを `tests/integration/cell-sheet.test.tsx` で確かめる

**Checkpoint**: User Story 1 と 2 が動く。項目を書いて写真を貼ると達成済みになる

---

## Phase 5: User Story 3 - ボードを一枚の画像として保存・共有する (Priority: P2)

**Goal**: ボード全体を、ボードと同じ縦横比（1:1・3:4・4:3 ちょうど）の一枚の画像として保存・共有する。タイトルは入れるか選べ、入れる場合はマス目に重ねる

**Independent Test**: 写真を何枚か貼ったボードを 5 種類のサイズで書き出し、寸法が contracts/export-image.md の表と一致し、画面表示と同じ配置になっている（quickstart.md シナリオ 3, 4）

### Tests for User Story 3

- [X] T049 [P] [US3] `tests/unit/export-size.test.ts` に `src/media/renderBoard.ts` の `exportSize(size)` のテストを書く: 3×3・4×4・5×5 は 2400×2400、3×4 は 1800×2400、4×3 は 2400×1800。`includeTitle` の有無で寸法が変わらない。長辺は 2000px 以上（FR-016）
- [X] T050 [P] [US3] `tests/unit/export-filename.test.ts` に `exportFileName(title, date)` のテストを書く: `<ボードのタイトル>-<YYYYMMDD>.jpg`、ファイル名に使えない文字（`\ / : * ? " < > |`）は `_` に置換
- [X] T051 [P] [US3] `tests/e2e/us3-export.spec.ts` に E2E を書く: 5 種類のサイズのボードそれぞれで、エクスポート画面のダウンロードを実行し（テストでは Web Share を無効化）、保存された JPEG の寸法が表と一致する。タイトルあり・なしで寸法が同じ。写真付きの 3×4 ボードで、画面の `GridView` と書き出し画像を幅 360px にそろえて比べ、(1) `layoutBoard` が返すマスの矩形と画面上の各マス要素の位置・大きさの差が 1px 以内、(2) 画面と画像で文字の行分割結果が同じ、(3) 写真付きマスの中心 50% の領域で色の平均の差が 8/255 以内（JPEG 圧縮による差を許すため）であること（SC-004）。タイトル帯の領域は比較から除く

### Implementation for User Story 3

- [X] T052 [US3] `src/media/renderBoard.ts` を実装する（contracts/export-image.md）: `exportSize(size)`、`exportFileName(title, date)`、`renderBoard(board, { includeTitle }): Promise<Blob>`。`layoutBoard` を出力幅で評価し、Canvas 2D に背景 → 達成済みマス（`getPhoto` の本体 Blob を `createImageBitmap` し、`sourceRect` で切り抜いて描画、下部に半透明の帯とタイトル）→ 未達成マス（カテゴリ帯・カテゴリ名・タイトル）→ 空マス（背景のみ）→ タイトル帯（入れる場合。マス目の上端に半透明の帯と影付きの白文字で中央寄せ）の順に描き、JPEG（品質 0.92）で `toBlob` する。達成数は描かない。T049・T050 を通す
- [X] T053 [US3] `src/media/shareImage.ts` を実装する（research.md R8）: `navigator.canShare?.({ files: [file] })` が真なら `navigator.share({ files: [file], title })`、そうでなければ `<a download>` でダウンロード。ユーザーが共有を取り消した（`AbortError`）場合は何もしない
- [X] T054 [US3] `src/ui/screens/ExportDialog.tsx`（`#/boards/:id/export`）を実装する（FR-013a, FR-017）: 「タイトルを入れる」スイッチ（初期値は `Preferences.exportIncludeTitle`、変更したら保存）、実際に書き出す画像を縮小表示したプレビュー（スイッチ変更で再描画）、「画像を保存・共有」ボタン、書き出し中の進行表示。スマホでは「共有メニューの『画像を保存』で写真アプリに保存できます」と案内する
- [X] T055 [US3] `src/ui/screens/BoardView.tsx` に「画像として保存」ボタンを追加し、`#/boards/:id/export` へ移動させる
- [X] T056 [US3] 25 マスすべてに写真を貼った 5×5 ボードの書き出しが 5 秒以内に終わること（SC-003）を `tests/e2e/us3-export.spec.ts` に追加する。遅い場合は写真のデコードを `Promise.all` で並列化する

**Checkpoint**: User Story 1〜3 が動く。ボードを一枚の画像として保存・共有できる

---

## Phase 6: User Story 4 - ホーム画面に追加してアプリとして使う (Priority: P2)

**Goal**: ホーム画面に追加でき、一度開いたあとは通信なしで全機能が使える。更新してもデータが消えない

**Independent Test**: 本番ビルドをサブパスで配信し、オフラインにして再読み込みしても、編集・写真の貼り付け・画像の書き出しができる（quickstart.md シナリオ 5）

### Tests for User Story 4

- [X] T057 [P] [US4] `tests/e2e/us4-offline.spec.ts` に E2E を書く（Chromium のみ）: `/photo-bucket/` を開いて Service Worker の `controller` が有効になるのを待つ → `context.setOffline(true)` → 再読み込み → ボード作成・項目入力・写真の貼り付け・画像の書き出しが成功する。`/photo-bucket/manifest.webmanifest` が取得でき、`start_url` と `scope` が `/photo-bucket/` である

### Implementation for User Story 4

- [X] T058 [P] [US4] `public/icons/` に PWA アイコンを置く: `icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、`apple-touch-icon.png`（180px）。シンプルなマス目と写真のモチーフの SVG 原画 `public/icons/icon.svg` から生成する
- [X] T059 [US4] `vite.config.ts` に `vite-plugin-pwa` を追加する（research.md R9）: `registerType: "prompt"`、`strategies: "generateSW"`、`workbox.globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"]`、`navigateFallback: "index.html"`。manifest は `name: "フォトバケットリスト"`、`short_name: "フォトバケット"`、`lang: "ja"`、`display: "standalone"`、`start_url` と `scope` は `base` と同じ、`theme_color`/`background_color`、T058 のアイコン。`index.html` に `apple-touch-icon` と `apple-mobile-web-app-capable` の meta を追加する
- [X] T060 [US4] `src/pwa/registerSW.ts` を実装し `src/main.tsx` から呼ぶ: `virtual:pwa-register` の `registerSW({ onNeedRefresh })` で、新しいバージョンがあれば「新しいバージョンがあります［更新］」のバーを表示し、押したら `updateSW(true)` で更新する（FR-022）
- [X] T061 [US4] `src/main.tsx` で起動時に `navigator.storage?.persist?.()` を要求し、`src/app/App.tsx` に `navigator.onLine` と `online`/`offline` イベントで「オフラインです（すべての機能を使えます）」を控えめに表示する（contracts/ui-routes.md 共通の表示）

**Checkpoint**: User Story 1〜4 が動く。インストールしてオフラインで使える

---

## Phase 7: User Story 5 - 複数のボードを持つ・バックアップする (Priority: P3)

**Goal**: 複数のボードを作って切り替え・削除でき、ボードを写真ごとファイルに書き出して、あとで読み込んで元に戻せる

**Independent Test**: ボードを 2 つ作って切り替えられる。書き出し → データ消去 → 読み込みで元どおりになり、壊れたファイルでは既存データが変わらない（quickstart.md シナリオ 6）

### Tests for User Story 5

- [X] T062 [P] [US5] `tests/integration/backup-roundtrip.test.ts` に往復テストを書く（SC-007）: 写真付きの 3×4 と 5×5 のボードを書き出し → DB を空にする → 読み込み → ボード・マス・`crop`・`achievedAt` が一致し、写真の Blob がバイト単位で同じ。サムネイルは読み込み時に再生成される
- [X] T063 [P] [US5] `tests/unit/backup-validate.test.ts` に contracts/backup-format.md の検証テストを書く: JSON として読めない、`format` が `"photo-bucket-backup"` でない、`formatVersion` が対応範囲より大きい、GridSize が 5 種類以外、`photoId` の参照先が `photos` にない、の各場合に contracts に書いた日本語メッセージのエラーになり、DB に何も書き込まれない。知らないフィールドは無視して読み込める
- [X] T064 [P] [US5] `tests/e2e/us5-backup.spec.ts` に E2E を書く: ボードを 2 つ作って一覧から切り替える → バックアップを書き出す（ダウンロードを捕捉）→ ボードを削除 → ファイルを読み込むと元に戻る → 壊れたファイルを読み込むとエラーが表示され一覧が変わらない

### Implementation for User Story 5

- [X] T065 [US5] `src/backup/exportBackup.ts` を実装する: 全ボードまたは指定ボードと、その写真本体を `FileReader` で data URL にしてまとめ、`{ format: "photo-bucket-backup", formatVersion: 1, exportedAt, boards, photos }` の JSON Blob を返す。ファイル名は `photo-bucket-<YYYYMMDD-HHmm>.photobucket.json`。書き出し後に `Preferences.lastBackupAt` を更新する
- [X] T066 [US5] `src/backup/importBackup.ts` を実装する: `parseBackup(text)` で contracts の検証をすべて行い（`validateBoard` を再利用）、data URL を Blob に戻して画像として読めるか確かめ、サムネイルを再生成する。`detectConflicts(parsed)` で既存 ID と重なるボードを返す。`applyBackup(parsed, resolutions)` で、ボードごとの「上書き」（既存のボードと写真を削除して置き換え）または「別のボードとして追加」（ボード・マス・写真に新しい ID、タイトル末尾に「（復元）」）を 1 つのトランザクションで書き込む。T062・T063 を通す
- [X] T067 [US5] `src/ui/screens/BoardList.tsx` を拡張する（FR-023, FR-024）: 各ボードのサムネイル（写真付きマスのうち最初の 1 枚）、「新しいボード」ボタン、ボードの削除（「このボードと写真 N 枚が削除されます」の確認つき）、「バックアップを書き出す」（全ボード）、「バックアップを読み込む」（`<input type="file" accept=".json,application/json">`。ID が重なるボードごとに「上書き」「別のボードとして追加」を選ぶダイアログ）。書き出しは `shareImage.ts` と同じ共有／ダウンロードの切り替えを使う
- [X] T068 [US5] `src/ui/screens/BoardSettings.tsx` に「このボードだけ書き出す」と「このボードを削除」を追加する
- [X] T069 [US5] `src/app/App.tsx` に、写真が 1 枚以上あり `lastBackupAt` が `null` または 30 日以上前なら、ボード一覧に「バックアップをおすすめします」の案内を表示する処理を追加する（Edge Cases）

**Checkpoint**: すべてのユーザーストーリーが単独で動く

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 複数のストーリーにまたがる仕上げ

- [X] T070 [P] 25 枚の写真を貼ったボード 3 つを用意し、ボードを開いてから表示まで 2 秒以内（SC-006）であることを `tests/e2e/performance.spec.ts` で確かめる。遅ければサムネイルの読み込みを表示中のマスに限定する
- [X] T071 [P] 本番ビルドの初回読み込み JS が gzip で 60KB 以下であることを確かめるスクリプト `scripts/check-bundle-size.mjs` を作り、`.github/workflows/deploy.yml` のビルド後に実行する
- [X] T072 [P] アクセシビリティの確認: `@axe-core/playwright` を開発依存に追加し、`tests/e2e/a11y.spec.ts` で全画面（一覧、作成、ボード、マス詳細、表示範囲、書き出し、設定）に重大な違反がないことを確かめる
- [X] T073 [P] `README.md` を作成する: アプリの概要、開発コマンド（quickstart.md へのリンク）、GitHub Pages の設定手順（Settings → Pages → Source を GitHub Actions）、リポジトリ名が異なる場合の `BASE_PATH` の変更方法
- [X] T074 アプリ全体で外部への通信が発生しないこと（憲章 I）を確かめる: `tests/e2e/privacy.spec.ts` で `page.on("request")` を監視し、主要フローの間に `localhost:4173` 以外へのリクエストがないことを確かめる
- [X] T075 quickstart.md の「自動テスト」「手元での起動」を実行してすべて成功することを確かめ、実機での確認手順の結果を `specs/001-photo-bucket-list/checklists/device-check.md` に記録する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。すぐに始められる
- **Foundational (Phase 2)**: Setup の完了が必要。すべてのユーザーストーリーを止める
- **User Stories (Phase 3〜7)**: Foundational の完了が必要
- **Polish (Phase 8)**: 必要なユーザーストーリーの完了が必要

### User Story Dependencies

- **US1 (P1)**: Foundational のあとに開始。他のストーリーに依存しない
- **US2 (P1)**: US1 のマス詳細シート（T035）と `CellTile`（T031）に機能を足すため、US1 のあとに行う。写真の削除は基盤フェーズ（T015a）にあるため、US1 は写真の機能がなくても完結する
- **US3 (P2)**: 写真なしのボードでも書き出せるので US1 のあとに開始できる。写真の描画（T052）は US2 の `crop.ts`（T042）と `photos.ts`（T044）を使う
- **US4 (P2)**: Foundational のあとならいつでも開始できる（アプリ全体の設定のみ）。E2E（T057）は US1〜3 の画面を使う
- **US5 (P3)**: 一覧画面（T033）とボード設定（T037）を拡張するため US1 のあと。写真の書き出しは US2 の `photos.ts` を使う

### Within Each User Story

- テストを先に書き、失敗することを確かめてから実装する
- `domain` → `storage`/`media` → `ui` の順に進める
- ストーリーを完了してから次の優先度に進む

### Parallel Opportunities

- Setup: T004〜T008 は並列で進められる
- Foundational: T010・T012・T014・T016・T019（テスト）と T015a、T018・T021・T022・T024・T025 は並列で進められる
- US1: T026・T027（テスト）と T030 は並列
- US2: T039・T040・T041（テスト）は並列
- US3: T049・T050・T051（テスト）は並列
- US4: T057 と T058 は並列。US4 全体は US2・US3 と並行して進められる
- US5: T062・T063・T064（テスト）は並列
- Polish: T070〜T073 は並列

---

## Parallel Example: User Story 2

```bash
# User Story 2 のテストを同時に書く:
Task: "tests/unit/crop.test.ts に src/domain/crop.ts のテストを書く"
Task: "tests/integration/photos-storage.test.ts に src/storage/photos.ts のテストを書く"
Task: "tests/e2e/us2-photo.spec.ts に写真を貼る E2E を書く"

# テストのあと、依存のない実装を同時に進める:
Task: "src/domain/crop.ts を実装する"
Task: "src/media/importPhoto.ts を実装する"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

このアプリの中心となる価値は「書いたやりたいことに写真を貼る」ことなので、P1 の 2 つのストーリーを MVP とする。

1. Phase 1: Setup を完了する
2. Phase 2: Foundational を完了する（すべてのストーリーを止める）
3. Phase 3: User Story 1 を完了し、単独で確認する（ボードと項目だけでも使える）
4. Phase 4: User Story 2 を完了し、単独で確認する
5. **STOP and VALIDATE**: GitHub Pages に公開して実機で試す

### Incremental Delivery

1. Setup + Foundational → 基盤が完成
2. US1 → 確認 → 公開（やりたいことボードとして使える）
3. US2 → 確認 → 公開（MVP: 写真を貼れる）
4. US3 → 確認 → 公開（一枚の画像として保存できる）
5. US4 → 確認 → 公開（インストール・オフライン対応）
6. US5 → 確認 → 公開（複数ボード・バックアップ）

各段階で前のストーリーを壊さないことを、既存の E2E で確かめる。

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

## Phase 9: Convergence

- [X] T076 `src/ui/screens/BoardView.tsx` で「画像として保存」ボタンを、達成数が総マス数と等しいときだけ表示する per FR-013, US3/AC5 (contradicts)
- [X] T077 `src/ui/screens/BoardList.tsx` から各ボードの削除ボタンを取り除く（削除は `BoardDangerZone` の「このボードを削除」のみ） per FR-023, US5/AC5 (contradicts)
- [X] T078 E2E を更新する: 未達成マスのあるボードを書き出すテスト（us3-export, a11y, privacy, us4-offline）は書き出し画面へ直接遷移し、`tests/e2e/us3-export.spec.ts` に「未達成があるとボタンが出ず、全達成で出る」テストを追加する per US3/AC1, US3/AC5 (partial)
- [X] T079 `tests/e2e/us5-backup.spec.ts` のボード削除を設定画面経由に変え、一覧に削除ボタンがないことを確かめる per US5/AC4, US5/AC5 (partial)

## Phase 10: ボードがないときの使い方の案内（FR-028, Clarifications 2026-09-24）

**Goal**: ボードが 1 つもないとき、ボード一覧（`#/`）に見出し「使い方」と 4 つの手順の番号付きリストを出す。ボードが 1 つ以上あるときは出さず、開く入り口も置かない（contracts/ui-routes.md、research.md R14）

**Independent Test**: データのない状態でアプリを開くと案内が出て、ボードを作って一覧に戻ると案内が消え、すべてのボードを削除すると再び出る

**文言（この順・この文言で表示する）**: 見出し「使い方」、手順 1.「ボードを作る」 2.「マスにやりたいことを書く」 3.「達成したら写真を貼る」 4.「全マス達成したら一枚の画像として保存・共有する」

- [X] T080 [P] [US1] `tests/e2e/us1-board.spec.ts` の最初のテストで、「最初のボードを作る」を押す前に `getByRole("heading", { name: "使い方" })` が見え、その下の `getByRole("list")` 内の `listitem` が 4 つで、上の文言どおりの順になっていることを確かめる。ボードを作って「ボード一覧へ」で一覧に戻ったあと、見出し「使い方」が存在しない（`toHaveCount(0)`）ことを確かめる per US1/AC6, US1/AC7
- [X] T081 [P] [US5] `tests/e2e/us5-backup.spec.ts` の、ボードを削除して「最初のボードを作る」ボタンが再び見えることを確かめている箇所（79 行目付近）に、見出し「使い方」も再び見えることの確認を足す per FR-028
- [X] T082 [US1] `src/ui/screens/BoardList.tsx` の `boards.length === 0` の分岐で、説明文 `<p class="muted">` のあと・「最初のボードを作る」ボタンの前に、`<section class="usage" aria-labelledby="usage-heading">` を置き、中に `<h2 id="usage-heading">使い方</h2>` と、上の 4 つの手順を `<li>` にした `<ol class="usage-steps">` を入れる。文言は JSX のテキストとして書き（`innerHTML` は使わない）、画像・アイコン・新しい依存・保存する状態は足さない。ボードがあるときの表示は変えない per FR-028, research.md R14
- [X] T083 [P] [US1] `src/styles/base.css` に `.usage` と `.usage-steps` のスタイルを足す。`.empty-state` は `text-align: center` なので、リストは `text-align: left` にしてブロックごと中央に寄せる（`display: inline-block` か `max-width` + `margin-inline: auto`）。360px 幅で横スクロールが出ないこと、文字色は既存の本文色を使いコントラスト比 4.5:1 以上を保つこと per FR-026, 憲章 IV
- [X] T084 `npm run lint`、`npm test`、`npm run test:e2e` を実行し、すべて成功することを確かめる（`tests/e2e/a11y.spec.ts` の "empty list" のチェックで案内を含めてアクセシビリティ違反がないこと）per quickstart.md

**Dependencies**: T080・T081・T083 は互いに並列に進められる。T082 は T080 のあと（テストが失敗することを確かめてから実装する）。T084 はすべてのあと
