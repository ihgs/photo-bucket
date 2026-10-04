---

description: "Task list for 005-board-templates"
---

# Tasks: テンプレートからボードを作る

**Input**: Design documents from `/specs/005-board-templates/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/new-board-templates.md, quickstart.md

**Tests**: 含める。quickstart.md にテストの一覧があり、テンプレートの中身の決まり（項目数・文字数・数字を含まない など）は自動テストで守るため（research.md R2）。テストを先に書いて失敗を確かめてから実装する。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- 単一プロジェクト: `src/`、`tests/` はリポジトリ直下
- 既存: `src/domain/grid.ts`（`GRID_SIZES`・`isInside`）、`src/domain/validation.ts`（`CELL_TITLE_MAX = 60`）、`src/domain/types.ts`（`CATEGORIES`）、`tests/e2e/helpers.ts`（`cell`・`fillCell`・`closeSheet`）

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 `src/domain/templates.ts` を新規作成し、型を定義する: `TemplateItem { row: number; col: number; title: string; category: Category }`（`row < size.rows`、`col < size.cols`、`title` は 1〜60 文字で数字を含まない）、`BoardTemplate { id: string; name: string; title: string; description: string; size: GridSize; items: TemplateItem[] }`（`title` は `{年}` を含められる、`items` の長さは `size.cols × size.rows`）（data-model.md）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: テンプレートの中身と純粋関数、1 回で保存する `createBoard`

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] `tests/unit/templates.test.ts` を新規作成する: `TEMPLATES` が 4 つ（id `domestic-travel`・`year-goals`・`best-food`・`seasons`）で id が重複しない。各テンプレートで、項目数 = `cols × rows`、全項目が `isInside` でマス目の内側かつ `(row, col)` が重複しない、タイトルが空でなく `CELL_TITLE_MAX`（60）以内で `/[0-9０-９]/` を含まない、カテゴリが `CATEGORIES` のどれか、サイズが `GRID_SIZES` のどれか。国内旅行の項目を位置順に並べると FR-003 の 12 項目の順（北海道旅行・東北旅行・関東旅行・甲信越旅行・北陸旅行・東海旅行・近畿旅行・山陰旅行・山陽旅行・四国旅行・九州旅行・沖縄旅行）で、すべて `go`。`resolveTemplateTitle("{年}年の目標", new Date(2026, 9, 4))` が「2026年の目標」、`{年}` のないタイトルはそのまま。`cellsFromTemplate(t, newId)` が項目数ぶんのマスを作り、id は `newId` の値、`memo` は空文字、`photoId`・`crop`・`achievedAt` を持たない（テストが失敗することを確かめる）
- [X] T003 `src/domain/templates.ts` に `TEMPLATES` を定義する。中身は spec.md FR-002・FR-003 のとおり（国内旅行 3×4、一年の目標 5×5、今年のベストごはん 3×3、季節の楽しみ 4×4。名前・タイトル・説明・各項目の位置・タイトル・カテゴリ。位置は左上から右へ、行ごと）。`resolveTemplateTitle(title, now = new Date())`（`{年}` を `now.getFullYear()` に置き換える）と `cellsFromTemplate(template, newId = () => crypto.randomUUID())`（各項目を `{ id: newId(), row, col, title, category, memo: "" }` にする）を実装する（T002 を通す）
- [X] T004 [P] `tests/integration/boards-storage.test.ts` に、`createBoard("国内旅行", { cols: 3, rows: 4 }, cells)` でボードとマスが保存され、`getBoard` で読み直すと同じマス（位置・タイトル・カテゴリ）があることを追加する。`cells` を渡さない呼び出しは今までどおり空のボードになること（テストが失敗することを確かめる）
- [X] T005 `src/storage/boards.ts` の `createBoard(title, size, cells: readonly Cell[] = [])` で、渡されたマスを入れたボードを 1 回の `put` で保存する。マスは渡された値をそのまま使う（`row`・`col` はサイズの内側である前提。テンプレートの検証は T002 で行う）（T004 を通す）

**Checkpoint**: テンプレートの中身とボードの作成が動く。`npm test` が通る

---

## Phase 3: User Story 1 - テンプレートを選んでボードを作る (Priority: P1) 🎯 MVP

**Goal**: 「新しいボード」の画面でテンプレートを選び、項目の入ったボードを作れる（research.md R5、contracts/new-board-templates.md）

**Independent Test**: 「新しいボード」で国内旅行を選んで作り、3×4 の 12 マスすべてに地方の項目が「行きたい」で入っていることを確かめる

### Tests for User Story 1

- [X] T006 [P] [US1] `tests/e2e/templates.spec.ts` を新規作成する: (a) `#/new` で「使わない（空のボード）」が選ばれている、(b) 国内旅行を選ぶとタイトル欄が「国内旅行」、サイズが 3×4（`aria-checked`）になり、ほかのサイズを押しても変わらない、入る項目に「北海道旅行」「沖縄旅行」が見える、(c) 「ボードを作る」で 12 マスすべてに項目が入り、左上が「北海道旅行」・右下が「沖縄旅行」で、カテゴリが「行きたい」、(d) 一年の目標を選ぶとタイトルが「<今年>年の目標」（テスト内で `new Date().getFullYear()`）・サイズ 5×5、(e) タイトルに「旅」と入れて 4×4 を選んでから国内旅行を選び、「使わない」に戻すと、タイトル「旅」・4×4 に戻る、(f) 国内旅行を選んでタイトルを「2027年 国内旅行」に書き換えて作ると、そのタイトルになる（テストが失敗することを確かめる）

### Implementation for User Story 1

- [X] T007 [P] [US1] `src/ui/components/SizePicker.tsx` に `disabled?: boolean` を追加する。`true` のとき各ボタンを `aria-disabled="true"` にして `onChange` を呼ばず、見た目を薄くする（FR-005）
- [X] T008 [US1] `src/ui/components/TemplatePicker.tsx` を新規作成する: 見出し「テンプレート」で名前を付けた `role="radiogroup"` に、「使わない（空のボード）」と `TEMPLATES` の各テンプレート（名前・サイズ（`gridLabel`）・説明）を選択肢として並べる（`role="radio"`・`aria-checked`、44px 以上）。テンプレートを選んでいるときは、見出し「入る項目」と、テンプレートのマス目の形（`grid-template-columns: repeat(cols, 1fr)`）に並べた項目名の一覧を出す。props は `value: string | null` と `onChange(id: string | null)`
- [X] T009 [US1] `src/ui/screens/NewBoard.tsx` にテンプレートの状態を足す: `templateId`（初期値 `null`）と、テンプレートを選ぶ直前の `{ title, size }`（`manual`）。テンプレートを選んだら（`null` から選んだときだけ `manual` を保存）、タイトルを `resolveTemplateTitle(t.title)`、サイズを `t.size` にする。`null` に戻したら `manual` を復元する。`SizePicker` には `disabled={templateId !== null}` を渡す。送信時、テンプレートがあれば `createBoard(title, size, cellsFromTemplate(t))`、なければ今までどおり `createBoard(title, size)`。`TemplatePicker` はタイトル欄の上に置く（T006 を通す）
- [X] T010 [P] [US1] `src/styles/base.css` にテンプレートの選択肢（名前・サイズ・説明の並び、選択中の枠）と項目のプレビュー（小さめの文字、マス目に並べる、5×5 でも 360px 幅で読めるよう折り返す）のスタイルを追加する

**Checkpoint**: テンプレートからボードを作れる

---

## Phase 4: User Story 2 - テンプレートから作ったボードを自由に直す (Priority: P1)

**Goal**: テンプレートから作ったボードが普通のボードと同じように使えることを確かめる（新しい実装はなく、確認のテストが中心）

**Independent Test**: 国内旅行から作ったボードで「沖縄旅行」を書き換え、マスを移動し、バックアップの書き出し → 読み込みで元どおりになることを確かめる

### Tests for User Story 2

- [X] T011 [P] [US2] `tests/e2e/templates.spec.ts` に追加する: 国内旅行から作ったボードで、右下のマス（沖縄旅行）を開いて「石垣島でダイビング」に書き換えると反映される。「移動」で左上と右下を入れ替えると入れ替わる
- [X] T012 [P] [US2] `tests/integration/backup-roundtrip.test.ts` に、`cellsFromTemplate` で作ったボードを書き出し → 「すべて置き換える」で読み込むと、マスが元どおり（位置・タイトル・カテゴリ）で、ボードにテンプレートの情報が含まれないことを追加する（FR-007）

### Implementation for User Story 2

- [X] T013 [US2] T011・T012 が通らない場合だけ、原因を直す（想定では追加の実装は不要。テンプレートから作ったボードは普通のボードと同じ形のため）

**Checkpoint**: テンプレートから作ったボードを普通のボードとして使える

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T014 [P] `tests/e2e/a11y.spec.ts` に、「新しいボード」で一年の目標（5×5）を選んだ状態で axe の違反がないことを追加する（Chromium のみ）
- [X] T015 [P] `specs/001-photo-bucket-list/contracts/ui-routes.md` の `#/new` の行の「主な操作」に「テンプレートの選択（005）」を足す
- [X] T016 `npm run lint`・`npm test`・`npm run test:e2e`・`npm run build && node scripts/check-bundle-size.mjs` を実行し、すべて通ること（初回読み込みの JS が gzip 60KB 以下）を確かめる
- [X] T017 quickstart.md の「2. 手元で操作して確かめる」を行う: 4 つのテンプレートで作り、項目の文字がマスに収まっているかをスマホ幅のスクリーンショットで確かめる（特に一年の目標の 5×5）。収まらない項目があれば、spec.md と `src/domain/templates.ts` の文言を短くする

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **US1** → **US2** → **Polish**
- US2 は US1 の画面で作ったボードを使う E2E を含むため、US1 のあと（T012 は Foundational のあとならいつでもよい）

### Parallel Opportunities

- T002 と T004（別ファイルのテスト）
- US1 の T006（テスト）、T007（SizePicker）、T010（スタイル）
- US2 の T011・T012
- Polish の T014・T015

---

## Parallel Example: User Story 1

```bash
Task: "T006 テンプレートの E2E を tests/e2e/templates.spec.ts に書く"
Task: "T007 SizePicker に disabled を足す"
Task: "T010 テンプレートの選択肢とプレビューのスタイルを足す"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1・2 を終える
2. US1 を終える: テンプレートからボードを作れる
3. 止めて確かめる（4 つのテンプレートで作り、文字が収まるか）

### Incremental Delivery

1. Setup + Foundational → テンプレートの中身と保存
2. US1 → 画面から作れる（MVP）
3. US2 → 普通のボードとして使えることの確認
4. Polish → アクセシビリティ・資料・全テスト・見た目の確認

---

## Notes

- テンプレートの中身を直すときは、spec.md FR-002・FR-003 と `src/domain/templates.ts` を両方直す（T002 の国内旅行の順のテストも）
- Commit after each task or logical group
