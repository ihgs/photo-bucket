# Research: ホーム画面への追加を促す案内

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-03

R 番号は plan・contracts・tasks から参照する。

## R1. 案内の種類の判定（FR-001, FR-004〜FR-006）

- **Decision**: 次の順で、案内の種類 `InstallGuide` を 1 つに決める純粋関数 `detectGuide(env)` を作る。`env` は
  `{ userAgent, maxTouchPoints, standalone, hasInstallEvent }`（実行時に集めてテストでは差し替える）。

  | 順 | 条件 | 種類 |
  |---|---|---|
  | 1 | 単独のアプリとして表示中（`display-mode: standalone` または iOS の `navigator.standalone`） | `none`（FR-001） |
  | 2 | Firefox（`Firefox/`、`FxiOS`） | `none`（FR-004） |
  | 3 | アプリ内ブラウザ（`Line/`、`Instagram`、`FBAN`・`FBAV`、`Twitter`） | `in-app`（FR-006） |
  | 4 | ブラウザの「追加できます」の合図（`beforeinstallprompt`）を受け取っている | `one-tap`（FR-005） |
  | 5 | iPhone・iPad（`iPhone`・`iPad`・`iPod`、または `Macintosh` かつ `maxTouchPoints > 1` の iPadOS） | `ios`（Safari 以外は `ios-other`） |
  | 6 | Mac の Safari（`Macintosh`、`Safari/`、`Chrome`・`Chromium`・`Edg` を含まない、タッチなし） | `mac-safari` |
  | 7 | それ以外（合図のない Chrome・Edge、判定できないブラウザ） | `none`（FR-004, FR-005） |

  iPhone・iPad の Safari 以外のブラウザ（Chrome は `CriOS`、Edge は `EdgiOS`）は `ios-other` とし、手順の文言を変える（Spec US2-2）。
- **Rationale**: ボタン1つで追加できるかは、ブラウザ名ではなく合図を受け取ったかで決めるのが確実（Samsung Internet なども含まれる）。
  合図のない Chromium（追加済み、条件未達）を `none` にすれば、FR-005 の「合図がないときは出さない」になる。
  ユーザーエージェントの判定は手順の案内が必要な端末だけに使い、判定できなければ出さない（誤った手順を示さない）。
- **Alternatives considered**: 機能の有無だけで判定する（iPhone とアプリ内ブラウザを区別できないため不採用）。

## R2. ブラウザの合図を取りこぼさない（FR-005, FR-008）

- **Decision**: `beforeinstallprompt` は読み込みの早い段階で一度だけ来るため、`src/main.tsx` の描画より前に
  `src/pwa/installPrompt.ts` を読み込み、`preventDefault()` してイベントを signal に保持する。
  `appinstalled` を受けたら「追加済み」を記録し（R4）、signal を空にする。
  「アプリとして追加」で `prompt()` を呼び、`userChoice` が `accepted` なら追加済み、`dismissed` なら「閉じた」と同じ扱い（FR-007）。
  `prompt()` は一度しか呼べないので、呼んだら signal を空にする（ブラウザがあとで再び合図を出せば、それを使う）。
- **Rationale**: ボード一覧の描画を待ってから登録すると、合図を取りこぼす。
- **Alternatives considered**: ブラウザ標準のミニ情報バー（Android）に任せる（出るかどうかを制御できず、iPhone では出ないため不採用）。

## R3. 手順の文言とアイコン（FR-006, US2, US3）

- **Decision**: 種類ごとの文言（contracts/install-banner.md）を定数にまとめる。
  - `ios`（Safari）: 「共有ボタン（アイコン）→『ホーム画面に追加』」。iOS 26 以降の Safari では共有ボタンが「…」メニューの中にあるため、
    「画面下の『…』または共有ボタン」と両方を書く。
  - `ios-other`（iOS の Chrome・Edge）: 「アドレスバーの共有ボタン（アイコン）→『ホーム画面に追加』」。
  - `mac-safari`: 「メニューの『ファイル』→『Dock に追加』」。
  - `in-app`: 「右上（または右下）のメニューから『ブラウザで開く』を選び、Safari（Android では Chrome）で開いてください」。
  - 共有ボタンのアイコンは lucide-preact の `Share`（四角に上向きの矢印）を使う（既存の依存。アイコン 1 つ分の増加）。
- **Rationale**: OS の版で共有ボタンの位置が変わるため、両方の場所を示すほうが迷わない。
- **既知の制約**: OS の画面が変わると文言が古くなる。手順は定数 1 か所にまとめ、変更しやすくしておく。

## R4. 案内の記録（FR-007, FR-008, Key Entities）

- **Decision**: IndexedDB の `meta` ストアにキー `installPrompt` で `{ dismissCount: 0 | 1 | 2, lastDismissedAt: string | null, installed: boolean }` を持つ。
  表示するかの判定は純粋関数 `shouldShowBanner(record, guide, now)`:
  `guide !== "none"` かつ `!installed` かつ（`dismissCount === 0`、または `dismissCount === 1` かつ `lastDismissedAt` から 30 日以上）。
- **Rationale**: `meta` はキーと値の形なので、DB スキーマの変更・マイグレーションは要らない（憲章 VI）。ボードのデータ・バックアップには入らない。
  iPhone ではホーム画面のアプリと Safari の保存場所が別なので、記録もそれぞれ別になる（ブラウザでの記録だけが案内に効く）。
- **Alternatives considered**: `localStorage`（ほかの設定が IndexedDB にあるのでそろえる）、`Preferences` に入れる（バックアップの対象ではないが、型を広げずに済む別キーにする）。

## R5. 表示の場所と重なり（FR-003, FR-009）

- **Decision**: `BoardList` の先頭（ボードがあるときは見出しの上、ないときは使い方の案内の上）に `InstallBanner` を置く。
  既存の `.banner` と同じ見た目で、画面の流れの中に置く（固定表示にしない）。新しいバージョンのお知らせ（画面下の固定バー）とは重ならない。
  起動時に最後のボードを開く動き（001）でボード一覧を通らないときは出さない（ボード一覧に戻ったときに出る）。
- **Rationale**: 流れの中に置けば、何も隠さない（SC-005）。

## R6. データの引き継ぎの注意（FR-012）

- **Decision**: 種類が `ios`・`ios-other`・`mac-safari` で、ボードが 1 つ以上あるときだけ、注意文と「バックアップを書き出す」ボタン（`#/backup` へ）を案内に足す。
- **Rationale**: Android・パソコンの Chrome・Edge は同じ保存場所なので不要。ボードがなければ移すものがない。
- **既知の制約**: Mac の Safari の「Dock に追加」が保存場所を分けるかは実機で確かめる（spec の Assumptions）。分けないとわかれば `mac-safari` を注意の対象から外す。

## R7. テスト

- **Decision**:
  - 単体（Vitest）: `detectGuide` を主な端末のユーザーエージェント（iPhone Safari・iPhone Chrome・iPadOS・Mac Safari・Mac Chrome・Android Chrome・LINE・Instagram・Firefox）で、`shouldShowBanner` を記録と日付の組み合わせで確かめる。
  - 結合（Vitest + fake-indexeddb）: 記録の読み書き、閉じる → 30 日後に 1 回だけ再表示 → 2 回目で二度と出ない。
  - E2E（Playwright）: Chromium（Pixel 7）では合図のイベントを疑似的に送り、帯の表示 →「アプリとして追加」で `prompt()` が呼ばれ、`accepted` で帯が消えることを確かめる。
    WebKit（iPhone 14 の UA）では手順の帯が出ること、ボードがあるとき引き継ぎの注意が出ること、閉じたら出ないことを確かめる。
    `display-mode: standalone` をエミュレートしたときは出ないこと。
  - 手動（実機）: iPhone の Safari で手順どおりに追加できる、Android の Chrome で追加できる、LINE のアプリ内ブラウザで開き直しの案内が出る。
- **Rationale**: 実際のインストール画面はテストのブラウザでは開けないため、合図を疑似的に送って確かめる。
