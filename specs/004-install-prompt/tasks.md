---

description: "Task list for 004-install-prompt"
---

# Tasks: ホーム画面への追加を促す案内

**Input**: Design documents from `/specs/004-install-prompt/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/install-banner.md, quickstart.md

**Tests**: 含める。quickstart.md にテストの一覧があり、憲章が「ストレージの保存・読み込み」の自動テストを求めているため。各段階でテストを先に書いて失敗を確かめてから実装する。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- 単一プロジェクト: `src/`、`tests/` はリポジトリ直下
- 既存のテスト用ヘルパー: `tests/helpers.ts`（`makeBoard`）、`tests/e2e/helpers.ts`（`createBoard` など）
- 既存の帯の見た目: `src/styles/base.css` の `.banner`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 `src/pwa/installPrompt.ts` を新規作成し、型を定義する: `InstallGuide = "one-tap" | "ios" | "ios-other" | "mac-safari" | "in-app" | "none"`、`InstallPromptRecord = { dismissCount: 0 | 1 | 2; lastDismissedAt: string | null; installed: boolean }`（ない場合は `{ dismissCount: 0, lastDismissedAt: null, installed: false }`）、`GuideEnv = { userAgent: string; maxTouchPoints: number; standalone: boolean; hasInstallEvent: boolean }`、定数 `REPROMPT_DAYS = 30`、引き継ぎの注意の対象 `NO_SHARED_DATA: InstallGuide[] = ["ios", "ios-other", "mac-safari"]`（data-model.md）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 案内の種類と表示の判定、記録、帯の枠。すべてのストーリーの前提

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] `tests/unit/install-guide.test.ts` を新規作成する: `detectGuide(env)` が research.md R1 の表の順で判定すること。ユーザーエージェントの例: iPhone Safari → `ios`、iPhone の Chrome（`CriOS`）・Edge（`EdgiOS`）→ `ios-other`、iPadOS（`Macintosh` かつ `maxTouchPoints: 5`）→ `ios`、Mac Safari（`maxTouchPoints: 0`）→ `mac-safari`、Mac Chrome（合図なし）→ `none`、Android Chrome（`hasInstallEvent: true`）→ `one-tap`、Android Chrome（合図なし）→ `none`、LINE（`Line/`）・Instagram・Facebook（`FBAN`）・X（`Twitter`）→ `in-app`（合図があっても）、Firefox（`Firefox/`・`FxiOS`）→ `none`、`standalone: true` → どれでも `none`。`shouldShowBanner(record, guide, now)` が: `guide = none` なら false、初回は true、`dismissCount: 1` で 29 日後は false・30 日後は true、`dismissCount: 2` は false、`installed: true` は false（テストが失敗することを確かめる）
- [X] T003 `src/pwa/installPrompt.ts` に純粋関数 `detectGuide(env: GuideEnv): InstallGuide` と `shouldShowBanner(record, guide, now = Date.now()): boolean` を実装する（research.md R1、data-model.md の「表示の判定」）。実行時の `env` を集める `currentGuideEnv()`（`navigator.userAgent`、`navigator.maxTouchPoints`、`matchMedia("(display-mode: standalone)").matches || navigator.standalone === true`、合図の有無）も用意する（T002 を通す）
- [X] T004 [P] `tests/integration/install-record.test.ts` を新規作成する: `getInstallRecord()` は記録がないとき初期値を返す、`recordDismiss(now)` で `dismissCount` が 1 → 2 と増えて 2 で止まり `lastDismissedAt` が更新される、`recordInstalled()` で `installed: true` になる（テストが失敗することを確かめる）
- [X] T005 `src/pwa/installPrompt.ts` に記録の読み書き `getInstallRecord()`・`recordDismiss(now?)`・`recordInstalled()` を実装する。IndexedDB の `meta` ストア、キー `installPrompt`（スキーマの変更なし）。`withQuotaGuard` を使う（T004 を通す）
- [X] T006 `src/ui/components/InstallBanner.tsx` を新規作成する（contracts/install-banner.md の構成の枠）: `<section class="banner install-banner" aria-labelledby>` に見出し「ホーム画面に追加すると、アプリのように使えます」・説明「通信のない場所でも使え、写真も消えにくくなります。」・「閉じる」ボタン（44px 以上）。マウント時に `getInstallRecord()` と `currentGuideEnv()` から `shouldShowBanner` で出すかを決め、出さないときは何も描かない。「閉じる」は `recordDismiss()` して消す。種類ごとの内容は子要素を出し分ける場所だけ用意する（各ストーリーで埋める）
- [X] T007 `src/ui/screens/BoardList.tsx` の先頭に `<InstallBanner hasBoards={boards.length > 0} />` を置く: ボードがあるときは見出し（`.top-bar`）の上、ないときは `.empty-state` の中の使い方の案内より上（FR-003）。ボード一覧以外には置かない
- [X] T008 [P] `src/styles/base.css` に `.install-banner` の見た目を追加する（既存の `.banner` を土台に、縦に並べる・手順の番号付きリスト・Share アイコンを文字の行に合わせる・ボタン行）

**Checkpoint**: 判定と記録が動き、ボード一覧に帯の枠が出せる。`npm test` が通る

---

## Phase 3: User Story 1 - ボタン1つでホーム画面に追加する (Priority: P1) 🎯 MVP

**Goal**: ブラウザの合図を受け取った端末で「アプリとして追加」を出し、追加画面を開く（research.md R2）

**Independent Test**: Chromium で合図を疑似的に送り、帯の「アプリとして追加」を押すと追加画面（`prompt()`）が呼ばれ、`accepted` で帯が消えて再読み込み後も出ないことを確かめる

### Tests for User Story 1

- [X] T009 [P] [US1] `tests/e2e/install-banner.spec.ts` を新規作成し、Chromium だけで動くテストを書く: `page.addInitScript` で読み込み後に `beforeinstallprompt` を疑似的に送る（`prompt` と `userChoice` を持つ `Event`。`prompt` が呼ばれたら印を残し、`userChoice` は `{ outcome: "accepted" }` を返す）。帯と「アプリとして追加」が出る → 押すと `prompt` が呼ばれる → 帯が消える → 再読み込みしても出ない。`outcome: "dismissed"` の場合は帯が消え、再読み込みしても出ない（閉じたのと同じ）。合図を送らない場合は帯が出ない。`page.emulateMedia` などで `display-mode: standalone` にしたときは合図があっても出ない（テストが失敗することを確かめる）

### Implementation for User Story 1

- [X] T010 [US1] `src/pwa/installPrompt.ts` に合図の受け取りを実装する: `listenForInstallPrompt()` で `beforeinstallprompt` を `preventDefault()` して signal `installEvent` に保持し、`appinstalled` で `recordInstalled()` して signal を空にする。`promptInstall()` は `installEvent` の `prompt()` を呼んで signal を空にし、`userChoice.outcome` が `accepted` なら `recordInstalled()`、`dismissed` なら `recordDismiss()` を呼んで結果を返す（research.md R2）
- [X] T011 [US1] `src/main.tsx` で、`render` より前に `listenForInstallPrompt()` を呼ぶ
- [X] T012 [US1] `src/ui/components/InstallBanner.tsx` で、`installEvent` の signal の変化に合わせて種類を判定し直し（合図があとから来ても帯が出るように）、種類 `one-tap` のとき主ボタン「アプリとして追加」を出す。押したら `promptInstall()` を呼び、結果にかかわらず帯を消す（T009 を通す）

**Checkpoint**: Android・パソコンの Chrome・Edge で、ボタン1つで追加できる

---

## Phase 4: User Story 2 - iPhone・iPad で追加の手順を知る (Priority: P1)

**Goal**: 手順の案内しかできない端末で手順を示し、データが引き継がれない端末でボードがあるときは注意を添える（research.md R3, R6）

**Independent Test**: WebKit（iPhone）でボード一覧に手順の帯が出ること、ボードがあるときだけ引き継ぎの注意と「バックアップを書き出す」が出ること、閉じると再読み込み後も出ないことを確かめる

### Tests for User Story 2

- [X] T013 [P] [US2] `tests/e2e/install-banner.spec.ts` に WebKit だけで動くテストを追加する（プロジェクトの iPhone 14 の UA）: ボードがないとき、帯に「『ホーム画面に追加』」を含む手順と共有ボタンのアイコン（`aria-label="共有ボタン"`）が出て、引き継ぎの注意は出ない。ボードを作って一覧に戻ると、注意「ホーム画面に追加したアプリには、ここで作ったボードは引き継がれません」と「バックアップを書き出す」が出て、押すと `#/backup` が開く。「閉じる」で消え、再読み込みしても出ない。ボード画面には帯が出ない（テストが失敗することを確かめる）
- [X] T014 [P] [US2] `tests/unit/install-guide.test.ts` に、手順の文言を返す `guideSteps(guide)` が `ios`・`ios-other`・`mac-safari` でそれぞれ contracts/install-banner.md の文言を返し、`one-tap`・`none` では空であることを追加する

### Implementation for User Story 2

- [X] T015 [US2] `src/pwa/installPrompt.ts` に `guideSteps(guide)` を実装する。文言は contracts/install-banner.md のとおり（`ios`: 「画面下の『…』または共有ボタン［アイコン］をタップ」→「『ホーム画面に追加』を選ぶ」、`ios-other`: 「アドレスバーの共有ボタン［アイコン］をタップ」→「『ホーム画面に追加』を選ぶ」、`mac-safari`: 「メニューの『ファイル』→『Dock に追加』を選ぶ」）。アイコンを入れる位置がわかる形（例: 文字列の配列とアイコンの印）で返す（T014 を通す）
- [X] T016 [US2] `src/ui/components/InstallBanner.tsx` で、種類が `ios`・`ios-other`・`mac-safari` のとき手順を番号付きリストで出す。共有ボタンのアイコンは lucide-preact の `Share` を `role="img" aria-label="共有ボタン"` で文中に置く
- [X] T017 [US2] `src/ui/components/InstallBanner.tsx` で、種類が `NO_SHARED_DATA` に含まれ `hasBoards` が true のときだけ、注意「ホーム画面に追加したアプリには、ここで作ったボードは引き継がれません。先にバックアップを書き出し、追加したアプリで読み込んでください。」とボタン「バックアップを書き出す」（`navigate({ name: "backup" })`）を出す（FR-012、T013 を通す）

**Checkpoint**: iPhone・iPad・Mac の Safari で手順が出て、ボードがあれば引き継ぎの注意が出る

---

## Phase 5: User Story 3 - アプリ内ブラウザでは普通のブラウザで開き直すよう案内する (Priority: P2)

**Goal**: アプリ内ブラウザで開き直しの案内を出す（research.md R3）

**Independent Test**: LINE のユーザーエージェントで開くと、開き直しの案内が出ることを確かめる

### Tests for User Story 3

- [X] T018 [P] [US3] `tests/e2e/install-banner.spec.ts` に、ユーザーエージェントを LINE（iPhone の UA の末尾に ` Line/14.0.0`）にした新しいコンテキストで、帯の見出しが「ブラウザで開くと、ホーム画面に追加できます」になり、「『ブラウザで開く』を選び、Safari（Android では Chrome）で開いてください」を含むことを追加する（テストが失敗することを確かめる）

### Implementation for User Story 3

- [X] T019 [US3] `src/ui/components/InstallBanner.tsx` で、種類 `in-app` のとき見出しを「ブラウザで開くと、ホーム画面に追加できます」に替え、本文「右上（または右下）のメニューから『ブラウザで開く』を選び、Safari（Android では Chrome）で開いてください」を出す。引き継ぎの注意は出さない（T018 を通す）

**Checkpoint**: アプリ内ブラウザで開き直しの案内が出る

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] `tests/e2e/a11y.spec.ts`（Chromium だけで動く）に、帯が出た状態のボード一覧で axe の違反がないことを追加する。2 つの状態を確かめる: (a) 合図を疑似的に送って「アプリとして追加」の帯が出た状態、(b) iPhone のユーザーエージェントを指定した新しいコンテキストで、手順の帯と引き継ぎの注意が出た状態
- [X] T021 既存の E2E（特に WebKit の `us1-board.spec.ts`・`us5-backup.spec.ts`）が帯の追加後も通ることを確かめる。帯で要素の取り違えが起きる場合（同じ文言のボタン・見出しなど）は、テスト側で帯を閉じた記録を入れるヘルパー `dismissInstallBanner(page)` を `tests/e2e/helpers.ts` に足して使う
- [X] T022 `npm run lint`・`npm test`・`npm run test:e2e`・`npm run build && node scripts/check-bundle-size.mjs` を実行し、すべて通ること（初回読み込みの JS が gzip 60KB 以下）を確かめる
- [ ] T023 quickstart.md の「2. 実機での確認」を iPhone・Android・LINE・Mac で行う。Mac の Safari の「Dock に追加」でデータが引き継がれるかを確かめ、引き継がれる場合は `NO_SHARED_DATA` から `mac-safari` を外し、research.md R6 に結果を書く

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → 各ストーリー → **Polish**
- US1・US2・US3 は Foundational のあと互いに独立（同じ `InstallBanner.tsx` と `install-banner.spec.ts` を変えるので、同時に進める場合はファイルの競合に注意）

### Within Each User Story

- テストを先に書いて失敗を確かめる → `installPrompt.ts` → `InstallBanner.tsx`

### Parallel Opportunities

- T002 と T004（別ファイルのテスト）、T008（スタイル）
- 各ストーリーのテスト（T009、T013・T014、T018）
- Polish の T020

---

## Parallel Example: Foundational

```bash
Task: "T002 detectGuide・shouldShowBanner のテストを tests/unit/install-guide.test.ts に書く"
Task: "T004 記録の読み書きのテストを tests/integration/install-record.test.ts に書く"
Task: "T008 帯のスタイルを src/styles/base.css に追加"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1・2 を終える
2. US1 を終える: Android・パソコンの Chrome・Edge でボタン1つで追加できる
3. 止めて確かめる（Android の実機で追加できるか）

### Incremental Delivery

1. Setup + Foundational → 判定・記録・帯の枠
2. US1 → ボタン1つで追加（MVP）
3. US2 → iPhone・iPad・Mac の手順と引き継ぎの注意（主な利用者は iPhone のため、実質的にはここまでで出荷するのがよい）
4. US3 → アプリ内ブラウザ
5. Polish → アクセシビリティ・既存テスト・実機

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- iPhone ではホーム画面に追加済みかを判定できないため、Safari で開き直すと閉じるまで帯が出る（仕様どおり）
- Commit after each task or logical group
