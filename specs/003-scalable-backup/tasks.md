---

description: "Task list for 003-scalable-backup"
---

# Tasks: ボードが増えても使えるバックアップと読み込み

**Input**: Design documents from `/specs/003-scalable-backup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/backup-export.md, contracts/backup-import.md, quickstart.md

**Tests**: 含める。憲章「開発ワークフローと品質ゲート」が「データモデルとスキーマ移行」「ストレージの保存・読み込み」の自動テストを求めており、
quickstart.md にテストの一覧があるため。各ストーリーでは、テストを先に書いて失敗を確かめてから実装する。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- 単一プロジェクト: `src/`、`tests/` はリポジトリ直下（plan.md の Project Structure）
- 既存のテスト用ヘルパー: `tests/helpers.ts`（`fakePhoto`・`makeBoard`）、`tests/e2e/helpers.ts`（`createBoard`・`fillCell`・`seedFullBoard` など）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 依存の追加はない。定数と型だけを用意する

- [ ] T001 [P] `BACKUP_MAX_BOARDS = 10`（1 回に書き出せるボード数の上限、FR-015）を `src/backup/format.ts` に追加する
- [ ] T002 [P] `src/backup/exportLog.ts` を新規作成し、型 `ExportLog = Record<string /* boardId */, string /* 書き出した日時 ISO 8601 */>`、定数 `BACKUP_REMIND_DAYS = 30`、書き出し状態の型 `ExportState = "never" | "changed" | "stale" | "fresh"` を定義する（data-model.md）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB スキーマ v2 と ExportLog の読み書き。すべてのストーリーの前提

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 [P] `tests/unit/db.test.ts` を更新する: 新しい DB は `schemaVersion` 2・`MIGRATIONS.length` 2・`photos` の索引が `["byBoard", "byBoardSize"]` になること。v1 で写真（`bytes` 付き）とボード、`meta` の `preferences.lastBackupAt` を入れてから v2 で開き直すと、(a) 各写真に `byteLength === bytes.byteLength` が付き `bytes` は同じバイト列のまま、(b) 索引 `byBoardSize` のキーが `[boardId, byteLength]`、(c) `updatedAt <= lastBackupAt` のボードだけが `meta` の `exportLog` にその日時で入ること。`lastBackupAt` が `null` なら `exportLog` は作られないこと（テストが失敗することを確かめる）
- [ ] T004 `src/storage/db.ts` にマイグレーション 1 → 2 を追加する: `StoredPhoto` に `byteLength: number`（写真本体 `bytes` のバイト数。サムネイルは含まない）を追加し、`PhotoBucketDB.photos.indexes` に `byBoardSize: [string, number]` を追加。マイグレーションは `photos` ストアをカーソルで 1 件ずつ読んで `byteLength` を書き足し、索引 `byBoardSize`（キー `["boardId", "byteLength"]`）を作り、`meta` の `preferences.lastBackupAt` があれば `updatedAt <= lastBackupAt` のすべてのボードを `meta` の `exportLog` に記録する。カーソルを await するため、`Migration` の型を `void | Promise<void>` にし、`openPhotoBucketDB` の `upgrade` で順に await する（IDB の要求以外を await しないこと。トランザクションが閉じるため）（T003 を通す）
- [ ] T005 `src/storage/photos.ts` の `toStored` で `byteLength` を設定する（`bytes.byteLength`）。`tests/helpers.ts` の `fakePhoto` など、`StoredPhoto` を直接作るテスト用コードも型に合わせる
- [ ] T006 [P] `tests/unit/export-state.test.ts` を新規作成し、`src/backup/exportLog.ts` の純粋関数をテストする: `exportStateOf(board, log, now)` が、`log[id]` なし → `"never"`、`board.updatedAt > log[id]` → `"changed"`、それ以外で `log[id]` が 30 日以上前 → `"stale"`、それ以外 → `"fresh"`。`needsReminder(boards, hasPhotos, log, now)` が、写真のあるボードに `never`・`changed`・`stale` が 1 つでもあれば `true`（テストが失敗することを確かめる）
- [ ] T007 `src/backup/exportLog.ts` に、`exportStateOf`・`needsReminder`（純粋関数）と、`getExportLog()`（`meta` の `exportLog`。ない場合は `{}`）、`recordExport(boardIds, at)`、`forgetExport(boardIds)`、`forgetExportInTx(tx, boardIds)` を実装する（T006 を通す）
- [ ] T008 `src/storage/boards.ts` の `deleteBoard` で、同じトランザクションの中で `forgetExportInTx(tx, [id])` を呼び、削除したボードの書き出し記録を消す（トランザクションに `meta` ストアを加える）。`tests/integration/boards-storage.test.ts` に、削除で記録が消えるテストを足す

**Checkpoint**: スキーマ v2 と ExportLog が使える。`npm test` が通る

---

## Phase 3: User Story 1 - 大きなバックアップでも最後まで読み込める (Priority: P1) 🎯 MVP

**Goal**: 検査と書き込みを分け、1 ボード＝1 トランザクションで順に読み込み、進み具合と結果を表示する（research.md R1, R5）

**Independent Test**: 写真付きのボードを 3 つ書き出し、そのうち 1 つのボードの写真のバイト列を壊したファイルを作って読み込む。
進み具合が 1/3 → 3/3 と進み、壊れていない 2 つが元どおりに戻り、壊れた 1 つは入らずに名前と理由が表示されることを確かめる

### Tests for User Story 1

- [ ] T009 [P] [US1] `tests/integration/import-run.test.ts` を新規作成する: (a) `inspectBackup` は写真の本体を読まずにボードと写真の情報（ZIP 内の場所を含む）を返し、形式が違う・壊れたファイルは今までと同じ `BackupError` のメッセージで失敗し何も書き込まない、(b) `runImportPlan`（`mode: "add"`、`onConflict: "skip"`）が 1 ボードずつ書き込み、`onProgress(done, total, boardTitle)` をボードごとに呼ぶ、(c) 2 つ目のボードの写真が画像として読めないとき、2 つ目は `boards` にも `photos` にも何も残らず、1 つ目と 3 つ目は入り、結果が `[{added}, {failed, reason: "写真のデータが欠けています"}, {added}]`、(d) 書き込んだボードの ExportLog の記録が消える（テストが失敗することを確かめる。サムネイル作成は既存の `makeThumb` の差し替えで行う）
- [ ] T010 [P] [US1] `tests/unit/import-plan.test.ts` を新規作成する: `planImport([source], existingIds, "add", onConflict)` が、同じ ID のボードの数を `conflicts` に、読み込むボードを `items` に入れること。`onConflict: "skip"` なら同じボードは結果が `"skipped"` になる予定として数えること（テストが失敗することを確かめる）

### Implementation for User Story 1

- [ ] T011 [US1] `src/backup/importBackup.ts` の `parseBackup` を `inspectBackup(file): Promise<ImportSource>` に変える: 検証（001 contracts/backup-format.md の表のとおり）はすべて残し、写真は「参照されているか」「`path` のエントリが ZIP にあるか」だけを確かめ、バイト列は読まない。`ImportSource` は `{ file, zip, boards, photos: { id, boardId, width, height, type, path }[] }`（data-model.md の ImportSource）
- [ ] T012 [US1] `src/backup/importBackup.ts` に `importBoard(source, board, action, opts)` を実装する: `action` は `"add" | "overwrite" | "copy"`。そのボードの写真だけを `zip.read(path)` で読み、`makeThumb` でデコードとサムネイル作成を行い（失敗したら `BackupError("写真のデータが欠けています")`）、`toStored` まで済ませてから、`boards`・`photos`・`meta` の 1 トランザクションで書き込む。`overwrite` は同じトランザクションで既存のボードと写真を消す。`copy` は今の `applyBackup` と同じく新しい ID と「（復元）」付きのタイトルにする。書き込んだボード ID の ExportLog を `forgetExportInTx` で消す。`withQuotaGuard` で容量不足を `StorageFullError` にする。今の `applyBackup`・`parseBackup` は削除する
- [ ] T013 [US1] `src/backup/importPlan.ts` を新規作成し、`planImport(sources, existingIds, mode, onConflict): ImportPlan`（純粋関数、data-model.md の ImportPlan）と、`runImportPlan(plan, onProgress): Promise<BoardResult[]>` を実装する。`runImportPlan` は `items` を順に `importBoard` し、ボードごとの結果 `"added" | "overwritten" | "copied" | "skipped" | "failed"`（＋理由）を集める。`StorageFullError` が出たら、そのボードと残りをすべて `failed`（理由「端末の保存容量が足りません」）にして止める（T009・T010 を通す。この段階では `mode: "add"` だけ）
- [ ] T014 [US1] `src/ui/components/ImportDialog.tsx` を新規作成する（contracts/backup-import.md の 1・3・4）: モーダルの `<dialog>`。choosing（選んだファイル名とボード数、「読み込む」「キャンセル」）→ running（「読み込み中… i / n ボード」、`<progress>`、今のボード名、`aria-live="polite"`、Esc と背景のタップで閉じない）→ done（0 件の行を出さない件数の一覧、読み込めなかったボードの名前と理由、「閉じる」）。この段階では同じボードの扱いは「読み込まない」固定
- [ ] T015 [US1] `src/ui/screens/BoardList.tsx` の `ImportButton` を、ファイルを選んだら `inspectBackup` して `ImportDialog` を開く形に変え、閉じたら一覧を読み込み直す。形式が違う・壊れたファイルは、ダイアログを開かずに今までどおりエラーを表示する。`src/ui/backupActions.ts` の `runImport` を削除する
- [ ] T016 [P] [US1] `src/styles/base.css` に読み込みダイアログの見た目（ファイル一覧、進み具合、結果の一覧）を追加する
- [ ] T017 [US1] `tests/e2e/us5-backup.spec.ts` を更新する: 今の「書き出し → 削除 → 読み込み」の流れを `ImportDialog` 経由にし、進み具合の表示（`i / n ボード`）と結果の件数が出ること、壊れたファイルでは何も変わらないことを確かめる

**Checkpoint**: 大きなバックアップでもボードごとに読み込め、進み具合と結果が出る。同じボードは読み込まない

---

## Phase 4: User Story 2 - 読み込み方をまとめて選ぶ（すべて置き換える／追加する） (Priority: P1)

**Goal**: 「すべて置き換える／追加する」と同じボードの扱いを 1 回で選べるようにし、置き換えは全ボード成功後にだけ削除する（research.md R3, R4）

**Independent Test**: ボードを 3 つ書き出したあと、1 つ削除・1 つ新規作成・1 つ編集してから「すべて置き換える」で読み込み、
端末のボードが書き出したときの 3 つと同じになることを確かめる。「追加する」で 3 つの扱いがすべての同じボードに適用されることを確かめる

### Tests for User Story 2

- [ ] T018 [P] [US2] `tests/unit/import-plan.test.ts` に追加する: `mode: "replace"` の `deleteCount` は「端末のボードのうちバックアップに含まれないものの数」。`mode: "add"` の `onConflict` が `"overwrite"`・`"copy"`・`"skip"` のとき、同じボードの予定がそれぞれ上書き・別として追加・読み込まないになること
- [ ] T019 [P] [US2] `tests/integration/import-run.test.ts` に追加する: (a) `replace` で全ボード成功 → 端末のボードの集合がバックアップと同じになり、消えたボードの写真と ExportLog の記録も消える、(b) `replace` で 1 ボード失敗 → 端末にもともとあったボードは 1 つも消えず、結果に「端末にもともとあったボードは削除していません」の印（`keptExisting: true`）が付く、(c) `replace` で容量不足（`StorageFullError` を起こす差し替え）→ もとのボードが残る、(d) `add` の 3 つの扱いがすべての同じボードに適用される（テストが失敗することを確かめる）

### Implementation for User Story 2

- [ ] T020 [US2] `src/backup/importPlan.ts` を拡張する: `planImport` で `mode: "replace"` のとき同じボードは `overwrite`、`deleteCount` を計算する。`runImportPlan` は `replace` で全ボードが `failed` なしのときだけ、バックアップに含まれない端末のボードとその写真を 1 つのトランザクションで削除し、削除したボードの ExportLog を消す。1 つでも `failed` があれば削除せず、結果に `keptExisting: true` を付ける。削除は必ず最後に行う（T018・T019 を通す）
- [ ] T021 [US2] `src/ui/components/ImportDialog.tsx` の choosing に「読み込み方」（「追加する」初期値／「すべて置き換える」）と、「追加する」で `conflicts > 0` のときだけ「端末にすでにある N 個のボード」（「上書きする」／「別のボードとして追加する」／「読み込まない」初期値）のラジオボタンを追加する（contracts/backup-import.md の 1）
- [ ] T022 [US2] `src/ui/components/ImportDialog.tsx` で「すべて置き換える」のとき、開始前に既存の `confirm` を 1 回だけ出す: タイトル「すべて置き換えますか？」、本文「端末にある N 個のボードを削除し、バックアップの M 個のボードに置き換えます。削除したボードは元に戻せません。」（N が 0 なら「端末のボードは削除されません」）、ボタン「置き換える」（`danger`）／「戻る」。done に `keptExisting` のときの一文を出す（contracts/backup-import.md の 2・4）
- [ ] T023 [US2] `tests/integration/backup-roundtrip.test.ts` を新しい関数（`inspectBackup`・`planImport`・`runImportPlan`）に合わせて書き直し、「書き出し → すべて置き換える」で SC-005（数・タイトル・項目・写真のバイト列・表示範囲・達成日の一致）を確かめる
- [ ] T024 [US2] `tests/e2e/us5-backup.spec.ts` に、置き換えの確認に件数が出ること、置き換え後のボード一覧がバックアップと同じになること、「追加する」で「上書きする」を選ぶと確認が 1 回で済むことを追加する

**Checkpoint**: 読み込みの確認は 2 回以内（SC-002）。置き換えの途中の失敗でもとのボードが残る（SC-006）

---

## Phase 5: User Story 3 - ボードを選んで書き出す (Priority: P2)

**Goal**: 書き出す画面（`#/backup`）でボードを選び、大きさと書き出し状態を見ながら書き出す（research.md R6, R7, R8）

**Independent Test**: ボードを 4 つ作り、書き出す画面で 2 つだけ選んで書き出し、そのファイルに選んだ 2 つだけが入っていること、
画面の合計の大きさが実際のファイルの大きさと 10% 以内で一致すること、書き出した 2 つが「M月D日に書き出し」になることを確かめる

### Tests for User Story 3

- [ ] T025 [P] [US3] `tests/unit/export-state.test.ts` に追加する: `estimateBackupSize(boardIds)` が写真の本体を読まずに（索引 `byBoardSize` の `openKeyCursor` だけで）ボードごとのバイト数を返し、実際に `exportBackup` したファイルの大きさとの差が 10% 以内（SC-007）
- [ ] T026 [P] [US3] `tests/unit/router.test.ts` に `#/backup` → `{ name: "backup" }`、`#/backup/pending` → `{ name: "backup", pending: true }` の往復を追加する
- [ ] T027 [P] [US3] `tests/integration/backup-roundtrip.test.ts` に、`runExport([a, b])` が共有・ダウンロードに渡せたとき `a`・`b` の ExportLog を記録し、キャンセル（`"cancelled"`）や失敗のときは記録しないことを追加する

### Implementation for User Story 3

- [ ] T028 [US3] `src/backup/exportBackup.ts` を変更する: `exportBackup(boardIds)` の `boardIds` を必須にし、1 ボードずつ写真を読んで ZIP の部品にしてから次のボードへ進む。写真が読めないボードがあれば中止し、`BackupError("『ボード名』の写真を読み込めなかったため、書き出しを中止しました")` を投げる（FR-017）。`Preferences.lastBackupAt` の更新をやめる。`estimateBackupSize(boardIds)` を追加する（写真の `byteLength` の合計＋写真 1 枚あたり約 200 バイト＋ボードの JSON の長さ）（T025 を通す）
- [ ] T029 [US3] `src/ui/backupActions.ts` の `runExport(boardIds)` で、`shareOrDownload` の結果が `"cancelled"` でなければ `recordExport(boardIds, now)` を呼ぶ（T027 を通す）。`src/ui/components/BackupReminder.tsx` の「すべて書き出す」呼び出しは、この段階では全ボード ID を渡す形にする（US4 で `#/backup/pending` へ変える）
- [ ] T030 [US3] `src/app/router.ts` に `{ name: "backup"; pending?: boolean }` を追加し、`#/backup`・`#/backup/pending` を解析・生成する（T026 を通す）。`src/app/App.tsx` の `Screen` で `backup` を `BackupExport` に割り当て、ボードが 1 つもなければ `#/` に戻す
- [ ] T031 [US3] `src/ui/screens/BackupExport.tsx` を新規作成する（contracts/backup-export.md）: 見出しと戻るボタン、「すべて選択」「すべて解除」、各行（`<label>` でチェックボックス・ボード名・「約 N MB」（1MB 未満は「1MB 未満」）・書き出し状態「未書き出し」「変更あり」「M月D日に書き出し」）、下部固定のバー（「N ボード・約 M MB」を `aria-live="polite"`、「書き出す」は 0 ボードなら押せない）。書き出したら「N ボードを書き出しました」を表示し、画面を閉じずに状態を更新する。この段階ではボードは初期状態ですべて選び、並び順はボード一覧と同じ
- [ ] T032 [US3] `src/ui/screens/BoardList.tsx` の「バックアップを書き出す」ボタンを `navigate({ name: "backup" })` に変える。`src/ui/screens/BoardDangerZone.tsx` の「このボードだけ書き出す」は `runExport([board.id])` のまま動くことを確かめる（FR-014）
- [ ] T033 [P] [US3] `src/styles/base.css` に書き出す画面の一覧（行全体がタップ領域 44px 以上）と下部固定のバー（`env(safe-area-inset-bottom)` を足す）を追加する
- [ ] T034 [US3] `tests/e2e/us5-backup.spec.ts` に、書き出す画面で 2 つだけ選んで書き出すとファイルに 2 つだけ入ること、合計の大きさが表示されること、書き出した 2 つの状態が変わることを追加する

**Checkpoint**: ボードを選んで書き出せ、大きさと書き出し状態が見える

---

## Phase 6: User Story 4 - 1 回に書き出せるのは 10 ボードまで (Priority: P2)

**Goal**: 書き出しを 10 ボードまでに制限し、書き出し漏れに気づけるようにし、分けたファイルをまとめて読み込めるようにする（research.md R2, R6, R9）

**Independent Test**: ボードを 12 個作り、11 個目が選べないこと、10 個と 2 個に分けて書き出せること、
その 2 つのファイルをまとめて「すべて置き換える」で読み込んで 12 個すべてが戻ることを確かめる

### Tests for User Story 4

- [ ] T035 [P] [US4] `tests/unit/export-state.test.ts` に追加する: `exportBackup` は 0 個・11 個で例外、1〜10 個で成功。並び替え `sortForExport(boards, log)` は 10 個を超えるとき「未書き出し」「変更あり」→ 書き出し日の古い順 → 更新の新しい順。`pendingSelection(boards, hasPhotos, log, now)` は写真のある `never`・`changed`・`stale` のボードを並び順に 10 個まで
- [ ] T036 [P] [US4] `tests/unit/import-plan.test.ts` に追加する: 2 つのファイルに同じ ID のボードがあるとき `updatedAt` の新しいほう（同じなら後に追加したファイル）を使い、1 つと数える。合計 0 ボードなら `ImportPlan` を作らない（「ボードが入っていません」）
- [ ] T037 [P] [US4] `tests/unit/backup-reminder.test.ts` を `needsReminder` を使う形に書き直す（写真のないボードだけなら出さない、`never`・`changed`・`stale` があれば出す、すべて `fresh` なら出さない）

### Implementation for User Story 4

- [ ] T038 [US4] `src/backup/exportBackup.ts` で `boardIds.length` が 0 または `BACKUP_MAX_BOARDS` を超えたら例外にする（二重の守り）。`src/backup/exportLog.ts` に `sortForExport`・`pendingSelection` を実装する（T035 を通す）
- [ ] T039 [US4] `src/ui/screens/BackupExport.tsx` を拡張する: ボードが 10 個を超えるときは「1 回に書き出せるのは 10 ボードまでです」を表示し、初期選択なし・「すべて選択」を出さない・`sortForExport` で並べる。10 個選んだら未選択の行のチェックボックスを `aria-disabled="true"` にし、押されたらその行の下に「1 回に書き出せるのは 10 ボードまでです。残りは別に書き出してください」を `role="status"` で出す。`pending` のときは `pendingSelection` を初期選択にする（FR-011, FR-016, FR-019, FR-020）
- [ ] T040 [US4] `src/ui/components/BackupReminder.tsx` を `needsReminder` で判定し、「書き出す」ボタンで `navigate({ name: "backup", pending: true })` する形に変える（T037 を通す）
- [ ] T041 [US4] `src/backup/importPlan.ts` の `planImport` で複数の `ImportSource` を統合する（同じ ID は `updatedAt` の新しいほう、同じなら後のファイル。各 item はどのソースのボードかを持つ）（T036 を通す）
- [ ] T042 [US4] `src/ui/components/ImportDialog.tsx` の choosing に「ファイルを追加」（`<input type="file" multiple>`）とファイルごとの「×」を追加する。追加するたびに `inspectBackup` し、失敗したファイルは一覧に入れずファイル名と理由を表示する。合計のボード数（重複は 1 つ）を表示し、0 ボードなら「読み込む」を押せず「ボードが入っていません」と表示する。`src/ui/screens/BoardList.tsx` の `ImportButton` の `<input>` にも `multiple` を付ける
- [ ] T043 [US4] `tests/e2e/us5-backup.spec.ts` に、ボード 12 個で 11 個目を選べないこと、10 個と 2 個に分けて書き出した 2 ファイルをまとめて「すべて置き換える」で読み込むと 12 個が戻ることを追加する（ボードは `seedFullBoard` か `createBoard` で作る）

**Checkpoint**: 10 ボードの上限、書き出し漏れの表示、分けたファイルのまとめての読み込みが動く

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 資料の更新、アクセシビリティ、実機での確認

- [ ] T044 [P] `specs/001-photo-bucket-list/contracts/ui-routes.md` の画面一覧に `#/backup`・`#/backup/pending` を追加し、`specs/001-photo-bucket-list/contracts/backup-format.md` の「書き出し単位」を「1〜10 ボード」、「ID が重複した場合」を 003 の読み込み方（contracts/backup-import.md）への参照に書き換える
- [ ] T045 [P] `tests/e2e/a11y.spec.ts` に、書き出す画面（ボード 12 個、10 個選択済み）と読み込みダイアログ（choosing・done）で axe の違反がないことを追加する
- [ ] T046 `src/domain/types.ts` の `Preferences.lastBackupAt` にコメントで「003 以降は使わない（スキーマ v2 のマイグレーションでのみ読む）」と書き、ほかに参照が残っていないことを `grep` で確かめる
- [ ] T047 `npm run lint`・`npm test`・`npm run test:e2e`・`npm run build && node scripts/check-bundle-size.mjs` を実行し、すべて通ること（初回読み込みの JS が gzip 60KB 以下）を確かめる
- [ ] T048 quickstart.md の「2. 手元で操作して確かめる」を実行する
- [ ] T049 quickstart.md の「3. 実機での確認」を iPhone と Android で行い、写真を全部埋めた 5×5 のボード 10 個（約 200MB）の書き出し・共有と「すべて置き換える」での読み込みが落ちずに 2 分以内に終わることを確かめる（SC-001, SC-004, research.md R11）。結果を PR に書く

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup のあと。すべてのストーリーの前提（スキーマ v2 と ExportLog）
- **US1 (Phase 3)**: Foundational のあと
- **US2 (Phase 4)**: US1 のあと（`importPlan.ts` と `ImportDialog.tsx` を拡張する）
- **US3 (Phase 5)**: Foundational のあと。US1・US2 とは独立（書き出し側だけ）
- **US4 (Phase 6)**: 書き出し側（T038〜T040）は US3 のあと、読み込み側（T041・T042）は US1 のあと。「すべて置き換える」でまとめて戻す E2E（T043）は US2・US3 の両方のあと
- **Polish (Phase 7)**: すべてのストーリーのあと

### Within Each User Story

- テストを先に書いて失敗を確かめる → 純粋関数・ストレージ → UI → E2E
- 同じファイルを変えるタスク（`ImportDialog.tsx`、`importPlan.ts`、`us5-backup.spec.ts`、`BackupExport.tsx`）は順番に行う

### Parallel Opportunities

- T001 と T002
- T003 と T006（どちらもテストで別ファイル）
- US1 の T009 と T010、実装中の T016
- US3 は US1・US2 と並行して進められる（書き出し側と読み込み側でファイルが分かれている）。US3 の中では T025・T026・T027、T033
- US4 の T035・T036・T037
- Polish の T044・T045

---

## Parallel Example: User Story 3

```bash
# テストを並行して書く:
Task: "T025 estimateBackupSize のテストを tests/unit/export-state.test.ts に追加"
Task: "T026 #/backup のルートのテストを tests/unit/router.test.ts に追加"
Task: "T027 ExportLog の記録のテストを tests/integration/backup-roundtrip.test.ts に追加"

# 画面の実装と並行して:
Task: "T033 書き出す画面のスタイルを src/styles/base.css に追加"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1・2 を終える（スキーマ v2 のマイグレーションを含む）
2. Phase 3（US1）を終える: 大きなバックアップでもボードごとに読み込め、進み具合と結果が出る
3. **止めて確かめる**: US1 の Independent Test と、実機で 200MB 規模の読み込みが落ちないこと（T049 の読み込み部分だけ先に行う）
4. この時点でも出荷できる（同じボードは「読み込まない」になる点だけ今までと違う）

### Incremental Delivery

1. Setup + Foundational → 土台
2. US1 → 落ちない読み込み（MVP）
3. US2 → 置き換え・まとめての選択（P1 を完了）
4. US3 → ボードを選んで書き出す
5. US4 → 10 ボードの上限と書き出し漏れの表示、複数ファイルの読み込み
6. Polish → 資料・アクセシビリティ・実機での確認

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- 同じボードの扱いは、US1 の段階では「読み込まない」固定になる（今の「ボードごとに聞く」はなくなる）。US1 だけで出荷する場合はこの点に注意する
- マイグレーション（T004）は `upgrade` の中で IDB の要求以外を await しないこと（トランザクションが自動で閉じる）
- Commit after each task or logical group
