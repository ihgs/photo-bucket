---

description: "Task list for 006-template-import"
---

# Tasks: 外部のテンプレートを取り込む

**Input**: Design documents from `/specs/006-template-import/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/template-format.md, contracts/import-ui.md, quickstart.md

**Tests**: 含める。形式の検証（SC-003・SC-004）と、外部に送るものがないこと（SC-006・憲章 I）は自動テストで守るため（research.md R8）。テストを先に書いて失敗を確かめてから実装する。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- 単一プロジェクト: `src/`、`tests/` はリポジトリ直下
- 既存: `src/domain/templates.ts`（`BoardTemplate`・`TemplateItem`・`TEMPLATES`・`findTemplate`・`resolveTemplateTitle`・`cellsFromTemplate`）、`src/domain/grid.ts`（`GRID_SIZES`・`isValidGridSize`・`gridLabel`）、`src/domain/validation.ts`（`BOARD_TITLE_MAX = 40`・`CELL_TITLE_MAX = 60`・`charLength`）、`src/domain/types.ts`（`CATEGORIES`・`Category`）、`src/ui/components/TemplatePicker.tsx`（`TemplateSheet`・`TemplatePreview`）、`src/ui/screens/NewBoard.tsx`、`tests/e2e/templates.spec.ts`（`chooseTemplate` などの補助関数）、`tests/e2e/helpers.ts`（`cell`）

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 `.specify/memory/constitution.md` を v1.3.0 に改定する（research.md R5）: 原則 I の広告の例外のあとに、research.md R5 の引用のとおり「ユーザーが自分で入力した URL から、テンプレートを読み込む通信を行ってよい (MAY)」と 3 つの MUST（ユーザーが指示したときだけ・URL への読み込みの要求だけを送り資格情報や端末内のデータを送らない・読み込んだ内容は検証してから使う）を加え、「上記の広告以外の…」の文を「上記の広告とテンプレートの読み込み以外の…」にする。Rationale に 1 文足す。ファイル先頭に Sync Impact Report（1.2.0 → 1.3.0、MINOR、影響: specs/006-template-import）を HTML コメントで付け、末尾の Version を `1.3.0`、Last Amended を `2026-10-06` にする
- [X] T002 `src/domain/templates.ts` の `BoardTemplate` に `imported?: true`（取り込んだテンプレートのときだけ。data-model.md）を追加する。`findTemplate` の戻り値・既存の `TEMPLATES` は変えない

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 形式の検証（貼り付けと URL の両方が使う）と、`NewBoard` を「選んだテンプレートそのもの」で扱う形への変更

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] `tests/unit/templateFormat.test.ts` を新規作成する（contracts/template-format.md の表のとおり）: (a) contracts の「例」を `parseTemplate` に渡すと `ok: true` で、`id: "imported"`・`imported: true`・`size: { cols: 3, rows: 3 }`・項目 8 件（`null` の 2 行目 3 列目＝`row: 1, col: 2` はない）、カテゴリは「いちご狩りに行く」が `go`、「かき氷を食べる」「栗ごはんを食べる」が `eat`、ほかは全体の `category`「やりたい」＝`want`。(b) 全体の `category` を省くと文字列の項目は `want`。(c) `description` を省くと空文字。(d) 前後の空白を除いて数える: 名前 20 文字・タイトル 40 文字・説明 60 文字・項目 60 文字ちょうどは通り、1 文字超えると誤り。絵文字 1 つは 1 文字。(e) 各誤りで `ok: false` と contracts の文になる: 100 KB（102,400 バイト、UTF-8 で数える）超え・JSON でない・`format` 違い・`version: 2`・`version` なし・`name` 空・`rows` なし・行の数がそろわない（「（3 行目）」）・サイズ `2×2`・`6×6`・`4×5`・マスのタイトル空・61 文字・カテゴリ `"food"`・マスが数値・すべて `null`。(f) マスの誤りが 7 件なら 5 件と「ほか 2 件」。(g) 知らない項目（例: `"author"`）は無視して通る。(h) `TEMPLATES` の 4 つを形式（`rows` の 2 次元配列）に書き直して `parseTemplate` に通すと、`size` と `items`（位置・タイトル・カテゴリ）が元と一致する（テストが失敗することを確かめる）
- [X] T004 `src/domain/templateFormat.ts` を新規作成し、`parseTemplate(text: string): { ok: true; template: BoardTemplate } | { ok: false; errors: string[] }` を実装する（research.md R2、contracts/template-format.md）。定数 `TEMPLATE_FORMAT = "bucket-grid-template"`・`TEMPLATE_FORMAT_VERSION = 1`・`TEMPLATE_MAX_BYTES = 102_400`・`TEMPLATE_NAME_MAX = 20`・`TEMPLATE_DESCRIPTION_MAX = 60` を export する。タイトルの上限は `BOARD_TITLE_MAX`、項目は `CELL_TITLE_MAX`、文字数は `charLength`（前後の空白を除いてから）。サイズは `{ cols: rows[0].length, rows: rows.length }` を `isValidGridSize` で確かめる。カテゴリは `CATEGORIES` の `id` と `label` の両方を受け付ける。行・列は 1 始まりで文に入れ、マスの誤りは全部集めて 5 件まで＋「ほか n 件」。形の誤り（大きさ・JSON・format・version・rows の形）は 1 件で止める。結果は `{ id: "imported", imported: true, name, title, description, size, items }`（T003 を通す）
- [X] T005 `src/ui/screens/NewBoard.tsx` の状態 `templateId: string | null` を `template: BoardTemplate | null` に変える（data-model.md の状態の移り変わり）。`chooseTemplate(t: BoardTemplate | null)`: `null` なら `manual` を復元、テンプレートなら（今 `null` のときだけ `manual` を保存し）`resolveTemplateTitle(t.title)` と `t.size` を入れる。`SizePicker` の `disabled={template !== null}`、送信時は `template ? cellsFromTemplate(template) : []`。`TemplateSheet` には `value={template?.id ?? null}` を渡し、`onChoose(id)` では `findTemplate(id)` を `chooseTemplate` に渡す。動きは今と同じ（既存の `tests/e2e/templates.spec.ts` がそのまま通ること）

**Checkpoint**: `npm test` と既存の `templates.spec.ts` が通る。取り込みの画面はまだない

---

## Phase 3: User Story 1 - テンプレートの中身を貼り付けて取り込む (Priority: P1) 🎯 MVP

**Goal**: テンプレートを選ぶシートから取り込み画面を開き、貼り付けた JSON からボードを作れる（contracts/import-ui.md、research.md R6・R7）

**Independent Test**: contracts/template-format.md の例を貼り付けて取り込み、8 マスに例のとおりの項目とカテゴリが入ったボードができることを確かめる

### Tests for User Story 1

- [X] T006 [P] [US1] `tests/e2e/template-import.spec.ts` を新規作成する（contracts/template-format.md の例を定数で持ち、`page.getByLabel("テンプレートの中身").fill(...)` で入れる。補助関数 `openImport(page)`＝`#/new` →「テンプレート」→ シートの「テンプレートを取り込む」）: (a) 取り込み画面に見出し「テンプレートを取り込む」、ラベル「テンプレートの URL」「テンプレートの中身」の欄がある。(b) 例を貼って「取り込む」→ シートが閉じ、「取り込んだテンプレート: 季節の楽しみ」、タイトル欄が「<今年>年 季節の楽しみ」、サイズ 3×3 が `aria-checked="true"` で 5×5 を押しても変わらない、「入る項目」の 6 番目が「（空き）」。(c) 「ボードを作る」→ 項目のあるマスが 8 つ、`cell(page, 1, 2)` が「いちご狩りに行く」で「行きたい」、`cell(page, 2, 3)` が空。(d) 1 行目 1 マス目を 61 文字にして「取り込む」→ `role="alert"` に「1 行目 1 列目: タイトルは60文字以内にしてください」、シートは開いたまま。(e) 名前を `<img src=x onerror="window.__xss=1">` にして取り込む → プレビューにその文字がそのまま出て、`window.__xss` が `undefined`。(f) 取り込んだあと「テンプレート」を開くと一覧はアプリの 4 つだけで、「季節の楽しみ」の取り込みは出ない。(g) 取り込み画面の「戻る」で一覧に戻り「テンプレートを取り込む」にフォーカスがある。(h) 取り込んだあと「やめる」→ 選ぶ前のタイトル・サイズに戻る（テストが失敗することを確かめる）

### Implementation for User Story 1

- [X] T007 [US1] `src/ui/components/TemplateImport.tsx` を新規作成する（貼り付けの部分）: 見出し「テンプレートを取り込む」（id を `aria-labelledby` に使う）、「戻る」ボタン、見出し「中身を貼り付け」と `<textarea>`（ラベル「テンプレートの中身」、`spellcheck={false}`、8 行程度、幅いっぱい）、「取り込む」ボタン。「取り込む」で `parseTemplate`。`ok` なら `onImported(template)`、そうでなければ `errors` を `role="alert"` の `<ul>` で表示する（文字は JSX で描くだけ、`dangerouslySetInnerHTML` を使わない）。下に「テンプレートの作り方」として README の「テンプレートを作る」への外部リンク（`https://github.com/ihgs/photo-bucket#テンプレートを作る`、`target="_blank" rel="noopener noreferrer"`）。props: `onImported(t: BoardTemplate)`・`onBack()`
- [X] T008 [US1] `src/ui/components/TemplatePicker.tsx` の `TemplateSheet` に表示の切り替え（`"list" | "import"`）を足す: 一覧の下に「テンプレートを取り込む」ボタン（lucide の `Download` アイコン）。押すと `TemplateImport` を表示し、`aria-labelledby` を取り込みの見出しに切り替え、最初の入力欄にフォーカス。`onBack` で一覧に戻し「テンプレートを取り込む」にフォーカスを戻す。props に `onImported(t: BoardTemplate)` を足す。`Esc`・背景・「閉じる」は今までどおり閉じる
- [X] T009 [US1] `src/ui/components/TemplatePicker.tsx` の `TemplatePreview` を直す: (1) `template.imported` なら「取り込んだテンプレート: {name}」、そうでなければ今までどおり「テンプレート: {name}」。(2) 項目を詰めて並べるのをやめ、`size.rows × size.cols` のすべてのマスを行ごとに並べ、項目のないマスは「（空き）」と表示する（`class="empty"` で薄く）
- [X] T010 [US1] `src/ui/screens/NewBoard.tsx` で `TemplateSheet` の `onImported` を受け取り、`chooseTemplate(template)` してシートを閉じる（T005 の形のまま。取り込んだテンプレートは状態にだけ持つ）（T006 を通す）
- [X] T011 [P] [US1] `src/styles/base.css` に取り込み画面（2 つの欄の区切り、`textarea` を幅いっぱい・等幅で小さめ、誤りの一覧の色とアイコン、「テンプレートを取り込む」ボタン）とプレビューの空きマス（`.template-preview li.empty`）のスタイルを追加する。360px 幅で横にはみ出さない。ボタンは 44px 以上

**Checkpoint**: 貼り付けでテンプレートを取り込み、ボードを作れる（MVP）

---

## Phase 4: User Story 2 - URL を入れて取り込む (Priority: P2)

**Goal**: https の URL から JSON を読み込み、貼り付けと同じように取り込める。外部に送るのは URL への GET だけ（research.md R3、contracts/import-ui.md の「読み込みの失敗の表示」）

**Independent Test**: `page.route` で模擬した `https://templates.example/seasons.json` を入れて読み込み、US1 と同じボードが作れることを確かめる

### Tests for User Story 2

- [X] T012 [P] [US2] `tests/unit/fetchTemplate.test.ts` を新規作成する（`fetchTemplateText(url, { signal?, fetch?, timeoutMs? })` の `fetch` を差し替える）: (a) 200 で本文を返すと `{ ok: true, text }`、呼び出しの `init` が `mode: "cors"`・`credentials: "omit"`・`referrerPolicy: "no-referrer"`・`cache: "no-store"`・`method` なし（GET）・`body` なし。(b) `http://…`・`data:…`・`javascript:…`・`ftp://…`・壊れた文字列は `fetch` を呼ばず `invalid-url`。(c) `navigator.onLine` を `false` にすると `fetch` を呼ばず `offline`。(d) `fetch` が `TypeError` → `blocked`。(e) 404 → `not-found`、500 → `http-error` と `status: 500`。(f) `timeoutMs: 50` で応答しない `fetch` → `timeout`。(g) 渡した `signal` を abort → `aborted`。(h) `Content-Length: 200000` → 本文を読まずに `too-large`。`Content-Length` なしで 102,401 バイトの本文 → `too-large`。(i) 本文が空白のあと `<!doctype html>` で始まる → `html`（テストが失敗することを確かめる）
- [X] T013 [P] [US2] `tests/e2e/template-import.spec.ts` に追加する（`page.route("https://templates.example/**", …)`）: (a) `Access-Control-Allow-Origin: *` 付きで例の JSON を返す URL を「テンプレートの URL」に入れて「読み込む」→ US1 の (b) と同じ表示になり、作ったボードも同じ。(b) 読み込みを許可しない公開先（`route.abort()` で模擬。Playwright の `fulfill` は CORS の確認を通さないため）→ 「この URL からは読み込めませんでした（公開先が読み込みを許可していないか、つながりません）」と「中身をコピーして…」の案内。(c) 404 → 「ファイルが見つかりませんでした」。(d) `http://templates.example/a.json` → 要求を出さずに「https で始まる URL を入れてください」。(e) 応答を 2 秒遅らせ、「読み込み中…」と「やめる」が出ている間に「やめる」→ 誤りは出ず、入力待ちに戻る。(f) `text/html` で `<!doctype html>` を返す → 「Web ページのようです…」。(g) Chromium のみ: `context.setOffline(true)` で「オフラインのため URL からは読み込めません」が出て、貼り付けでは取り込める（SC-005）
- [X] T014 [P] [US2] `tests/e2e/privacy.spec.ts` に追加する: `page.route` で模擬した URL から取り込む間の `page.on("request")` を集め、アプリのオリジン以外への要求が、入れた URL への `GET` 1 件だけで、`postData()` が `null`、`headers()` に `cookie` と `referer` がないこと（SC-006・FR-006）。既存の「主な操作で外部通信がない」テストはそのまま通ること

### Implementation for User Story 2

- [X] T015 [US2] `src/net/fetchTemplate.ts` を新規作成し、`fetchTemplateText(url: string, opts?: { signal?: AbortSignal; fetch?: typeof fetch; timeoutMs?: number }): Promise<FetchResult>` を実装する（data-model.md の `FetchResult`、research.md R3）。`new URL(url)` が失敗するか `protocol !== "https:"` なら `invalid-url`。`navigator.onLine === false` なら `offline`。`AbortController` を作り、`opts.signal` の abort と `setTimeout(timeoutMs ?? 10_000)` の両方で止める（どちらで止めたかを覚えて `aborted` / `timeout` を分ける）。`fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", redirect: "follow", signal })`。`TypeError` → `blocked`。404 → `not-found`、ほかの `!ok` → `http-error`（`status`）。`Content-Length` が `TEMPLATE_MAX_BYTES` を超えれば読まずに `too-large`。本文は `body.getReader()` で読み、合計が `TEMPLATE_MAX_BYTES` を超えた時点で `cancel()` して `too-large`。`TextDecoder` で文字にし、`trimStart()` が `<` で始まれば `html`。ファイル先頭に「アプリで外部と通信する唯一の場所（憲章 I v1.3.0）」とコメントを書く（T012 を通す）
- [X] T016 [US2] `src/ui/components/TemplateImport.tsx` に「URL から」の部分を足す（contracts/import-ui.md）: 見出し「URL から」、`<input type="url" inputmode="url" autocomplete="off">`（ラベル「テンプレートの URL」、placeholder `https://`）、「読み込む」ボタン。押すと `AbortController` を作って `fetchTemplateText` を呼び、読み込み中は `aria-busy`、「読み込み中…」と「やめる」を出して「読み込む」を無効にする。`ok` なら `parseTemplate` に渡して貼り付けと同じ扱い。失敗は contracts の表の文と、2 行目「中身をコピーして、下の「中身を貼り付け」で取り込むこともできます。」を `role="alert"` に出す（`aborted` は何も出さない）。`navigator.onLine` が `false` の間（`online`/`offline` イベントで更新）は URL 欄の下に「オフラインのため URL からは読み込めません」を出す。「戻る」・シートを閉じる・コンポーネントの破棄で読み込み中なら abort する（T013 を通す）
- [X] T017 [US2] T014 が通ることを確かめ、通らなければ `src/net/fetchTemplate.ts` の `fetch` の設定を直す

**Checkpoint**: URL からも取り込める。外に送るのは URL への GET だけ

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T018 [P] `README.md` に「テンプレートを作る」の節を追加する: contracts/template-format.md の「例」「項目」の表・カテゴリの書き方・100 KB の上限・「公開先の案内」（CORS、GitHub の Raw と Gist の Raw の URL、読めないときは貼り付け）をそのまま載せる（FR-002。T007 のリンク先の見出しと一致させる）
- [X] T019 [P] `tests/e2e/a11y.spec.ts` に、取り込み画面を開いた状態と、誤りの一覧を表示した状態で axe の違反がないことを追加する（Chromium のみ）
- [X] T020 [P] `specs/005-board-templates/contracts/new-board-templates.md` の「構成」のシートの図の下に「取り込み（006）: 一覧の下の「テンプレートを取り込む」。specs/006-template-import/contracts/import-ui.md」と 1 行足す
- [X] T021 `npm run lint`・`npm test`・`npm run test:e2e`・`npm run build && node scripts/check-bundle-size.mjs` を実行し、すべて通ること（初回読み込みの JS が gzip 60KB 以下）を確かめる
- [X] T022 quickstart.md の「手で確かめる」の 1〜3 を行う（3 は実際の Gist の Raw の URL で読めること、通常のページの URL で読めないことを含む）。スマホ幅（Pixel 7 相当）で取り込み画面と、5×5 で空きマスのあるプレビューのスクリーンショットを撮り、はみ出しがないことを確かめる

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **US1** → **US2** → **Polish**
- T001（憲章の改定）は US2 の実装（T015）より前に終える。US1 は外部通信をしないので、T001 がなくても進められる
- US2 は US1 の取り込み画面（T007・T008）に URL の欄を足すため、US1 のあと。ただし T012（単体テスト）と T015（`fetchTemplate.ts`）は Foundational のあとならいつでもよい
- T018 の見出しは T007 のリンク先と合わせる

### Parallel Opportunities

- T003（テスト）と T005（`NewBoard` の状態の変更）
- US1 の T006（E2E）と T011（スタイル）
- US2 の T012・T013・T014（別ファイルのテスト）
- Polish の T018・T019・T020

---

## Parallel Example: User Story 2

```bash
Task: "T012 fetchTemplateText の単体テストを tests/unit/fetchTemplate.test.ts に書く"
Task: "T013 URL の取り込みの E2E を tests/e2e/template-import.spec.ts に足す"
Task: "T014 送るものの確認を tests/e2e/privacy.spec.ts に足す"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1・2 を終える
2. US1 を終える: 貼り付けで取り込んでボードを作れる（外部通信なし）
3. 止めて確かめる（quickstart.md の 1・2）

### Incremental Delivery

1. Setup + Foundational → 憲章の改定・形式の検証・`NewBoard` の状態の整理
2. US1 → 貼り付けで取り込める（MVP）
3. US2 → URL からも取り込める
4. Polish → README の形式の説明・アクセシビリティ・全テスト・見た目の確認

---

## Notes

- 形式の決まりを変えるときは、contracts/template-format.md・`src/domain/templateFormat.ts`・`tests/unit/templateFormat.test.ts`・README の 4 か所をそろえる
- 外部と通信するコードは `src/net/fetchTemplate.ts` だけに置く（憲章 I）
- Commit after each task or logical group
