# Research: ボード画面の帯広告

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-24

Technical Context に残った不明点と、外部の広告配信サービスを静的な PWA に組み込む際の
やり方を調べた結果をまとめる。R 番号は plan・contracts・tasks から参照する。

## R1. 広告配信サービスと広告ユニットの形

- **Decision**: Google AdSense の**ディスプレイ広告ユニット（固定サイズ 320×50）**を 1 つ、ボード画面の
  下端に固定した自前の枠の中に置く。広告の読み込みは AdSense 標準のタグ
  （`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<ca-pub-…>` を `async` で読み込み、
  `<ins class="adsbygoogle">` を置いて `adsbygoogle.push({})`）で行う。
- **Rationale**:
  - 320×50 はモバイルの帯広告の標準サイズで、高さが決まっているため枠の高さを先に確保でき、
    読み込み後にボードの位置がずれない（Edge Case）。高さ 50px＋「広告」ラベル約 16px＋余白で約 70px となり、
    縦画面（高さ 640px 以上）で 11%、横向きの低い画面（高さ 360px）でも 19.4% と FR-004 に収まる。
  - AdSense の「アンカー広告」（自動広告の一種）は表示位置・閉じるボタン・表示する画面をアプリ側で制御できず、
    FR-002（ボード画面だけ）・FR-012（閉じるボタンなし）・FR-003（ボタンを隠さない）を満たせない。
  - レスポンシブ広告（`data-full-width-responsive`）は高さが読み込み後に決まり、FR-004 の上限を保証できない。
- **Alternatives considered**:
  - 自動広告（アンカー）: 上記のとおり制御できないため不採用。
  - 他の広告ネットワーク: 仕様の例示が AdSense で、個人の静的サイトでも審査を受けやすいため AdSense を第一候補とする。
    枠と読み込み処理を `src/ads/` に閉じ込め、差し替え可能にしておく（R2）。

## R2. 広告の設定（パブリッシャー ID・広告ユニット ID）の渡し方

- **Decision**: ビルド時の環境変数 `VITE_ADSENSE_CLIENT`（`ca-pub-…`）と `VITE_ADSENSE_SLOT`（広告ユニット ID）で渡す。
  **どちらかが未設定なら広告機能をまるごと無効**にし、枠も出さず、外部スクリプトも読み込まない。
  本番の GitHub Actions ではリポジトリ変数（`vars.ADSENSE_CLIENT` など）から渡す。
- **Rationale**: ID はコードに書き込まずに済み、開発・単体テスト・既存の E2E（`tests/e2e/privacy.spec.ts` の
  「外部通信ゼロ」）は設定なしのビルドでそのまま通る。パブリッシャー ID 自体は公開情報なので秘匿は不要。
- **Alternatives considered**: 設定ファイルをリポジトリに置く（ID を変えるたびにコミットが要るため不採用）、
  実行時に JSON を取得する（外部通信が増え、オフライン時の扱いが複雑になるため不採用）。

## R3. 広告の読み込みタイミングと、ボード画面以外で通信しないこと（FR-009, FR-011）

- **Decision**:
  - 外部スクリプトは `index.html` には書かず、**ボード画面（`#/boards/:id`）を初めて表示し、ボードの描画が終わったあと**
    （`requestIdleCallback`、非対応の Safari では `setTimeout(…, 0)`）に `<script async>` を動的に追加する。
  - 同意の確認（R6）が済むまで・オフラインのあいだは読み込まない。
  - 帯広告の枠（`<ins>`）はボード画面にいるあいだだけ DOM に置き、ほかの画面へ移ったら取り除く。
    再びボード画面を開いたら新しい `<ins>` を置いて `push({})` し直す。
- **Rationale**: ボードの描画を広告が待たない（SC-002）。一覧などを先に開いた場合は外部通信が発生しない。
- **既知の制約（リスク）**: 一度読み込んだ `adsbygoogle.js` はページから取り除けず、ほかの画面へ移ったあとも
  サービス側の判断で通信する可能性がある。対策として、広告の枠を取り除くことで新しい広告のリクエストは起きないようにし、
  E2E で「ボード画面を開く前に外部通信がない」「ボード画面を離れたあと新しい広告リクエスト（`/pagead/ads` 等）がない」ことを確かめる。
  それでも通信が残る場合は、plan の Complexity Tracking に記録して憲章の文言を見直す。
- **Alternatives considered**: `iframe` で広告専用ページを包んで画面遷移時に破棄する（AdSense は自サイトの別ページを
  iframe で埋め込む配置をポリシー上認めていないため不採用）。

## R4. 広告を出せないときの判定と枠の扱い（FR-008）

- **Decision**: 枠は次の状態を持ち、`hidden`（表示しない・高さ 0）以外のときだけ高さを確保する。
  - 次のいずれかで `hidden` にする: 広告機能が無効（R2）、`navigator.onLine === false`、スクリプトの `error` イベント、
    `<ins>` に `data-ad-status="unfilled"` が付いた（`MutationObserver` で検知）、`push` が例外を投げた、
    広告ブロックでスクリプトが読み込まれない・`window.adsbygoogle` が配列のまま一定時間（5 秒）`loaded` にならない。
  - `data-ad-status="filled"` で `shown` にする。読み込み中（`loading`）は高さを確保し、ラベル「広告」だけを表示する。
  - `offline` イベントでは `hidden` にし、`online` に戻ったらボード画面にいる場合に限り読み込みをやり直す。
- **Rationale**: 空の枠やエラー表示を残さない（FR-008）。読み込み中に高さを確保しておくことで、
  広告が出たときにボードがずれない。広告が出ないと確定したときだけ枠を詰める（Edge Case）。
- **Alternatives considered**: 枠を常に確保しておく（オフラインで空の帯が残るため不採用）。

## R5. レイアウト：ボタンを隠さない・シートより奥・トーストと更新バーとの関係（FR-003, FR-004）

- **Decision**:
  - 枠は `position: fixed; bottom: 0` で画面幅いっぱい（デスクトップではボードの最大幅に合わせて中央寄せ）。
    下端には `env(safe-area-inset-bottom)` の余白を足す。
  - 枠が `hidden` 以外のあいだ、ルート要素に CSS 変数 `--ad-inset`（枠の高さ）を設定し、
    `.app` の下余白とトースト（`.toasts`）の `bottom` に足す。これでボードを一番下までスクロールしたとき
    最後の行とボタンが帯の上に出る。
  - 重なり順は、帯広告 `z-index: 40` < シートとダイアログの背景 `.modal-backdrop`（50）< 更新バー（90）< トースト（100）。
    マスの編集シート（`#/boards/:id/cells/:r/:c`）はボード画面を背後に残して重ねる作りのため、
    帯はシートの背景に覆われて見えず、操作もできない（FR-002・Edge Case）。枠には `inert` を付け、
    シートを開いているあいだは読み上げ・フォーカスの対象からも外す。
- **Rationale**: シートの開閉のたびに枠を消して作り直すと、広告のリクエストが増えて AdSense のポリシー上も好ましくない。
  シートの背景で覆えば FR-002 の「シートには表示しない」を満たしつつ、広告は 1 回の読み込みで済む。
- **Alternatives considered**: シートを開いたら枠を取り除く（リクエストが増えるため不採用）、
  `position: sticky` でボードの末尾に置く（スクロールしないと見えず「画面の一番下」にならないため不採用）。

## R6. 同意（Cookie）とプライバシーポリシー（FR-014）

- **Decision**:
  - EEA・英国・スイス向けの同意の取得は、AdSense 管理画面の「プライバシーとメッセージ」で Google 認定の
    同意管理（CMP）メッセージを有効にして任せる。メッセージはボード画面で `adsbygoogle.js` を読み込んだときに
    AdSense のタグが自動で表示し、同意が得られるまでパーソナライズ広告は配信されない。アプリ側に同意画面は作らない。
  - 日本の電気通信事業法の外部送信規律に対応するため、送信先（Google）、送信される情報（Cookie ID、閲覧しているページの URL、
    端末・ブラウザの情報など）、利用目的（広告の配信と効果測定）、オプトアウトの方法（Google の広告設定）を
    **プライバシーポリシーのページ**（`public/privacy.html`、静的 HTML）で公表する。ボードの内容・写真は送らないことも明記する。
  - プライバシーポリシーへは、ボード一覧の下部と、帯広告の「広告」ラベルの横の「広告について」リンクから開ける。
    ページは precache の対象（`**/*.html`）なのでオフラインでも読める。
- **Rationale**: 自前で CMP を作るより、Google 認定 CMP を使うほうが規約に確実に沿う。静的ページにすると AdSense の審査
  （プライバシーポリシーの URL 提出）にもそのまま使える。
- **Alternatives considered**: アプリ内の画面（`#/privacy`）にする（審査用の URL としては静的ページのほうが確実なため不採用）、
  外部の CMP サービス（依存と通信が増えるため不採用）。

## R7. オフライン・Service Worker（憲章 III）

- **Decision**: Workbox の precache 対象は自サイトのファイルだけで、`runtimeCaching` は設定しない（今のまま）。
  広告のスクリプト・画像は Service Worker でキャッシュしない。`navigateFallback` は同一オリジンのナビゲーションだけに効くため影響しない。
- **Rationale**: 憲章 III（v1.2.0）の「広告をオフライン用にキャッシュしてはならない」を満たす。
- **Alternatives considered**: なし。

## R8. 保存画像に広告を入れない（FR-007）

- **Decision**: 保存画像は `src/media/renderBoard.ts` がボードのデータから Canvas に描くため、画面の DOM を写さない。
  広告を含まないことは構造上保証されるので、変更は不要。E2E で広告表示中に保存した画像が、広告なしのビルドで保存した画像と
  同じ寸法であることを確かめる。
- **Alternatives considered**: なし。

## R9. 公開先（GitHub Pages）での AdSense の前提条件

- **Decision**: 次をアプリのコード外の前提作業として quickstart.md に記載する。
  - AdSense にサイトを登録して審査に通る。サイトは `https://ihgs.github.io/photo-bucket/` のようにサブパスで配信しているため、
    **`ads.txt` はドメインの直下（`https://ihgs.github.io/ads.txt`）に置く必要があり**、ユーザーサイト用のリポジトリ
    `ihgs/ihgs.github.io` に置く。このリポジトリでは置けない。
  - `github.io` のサブドメインは AdSense の審査で登録できない場合がある。その場合は独自ドメインを GitHub Pages に設定する
    （`BASE_PATH` を `/` に変えればアプリは動く）。
- **Rationale**: コードが完成しても審査に通らなければ広告は出ない。前提を先に明らかにしておく。
- **Alternatives considered**: なし（AdSense の仕組み上の前提）。

## R10. テスト方法

- **Decision**:
  - 単体・結合（Vitest）: 枠の状態遷移（R4）を、`adsbygoogle.js` を読み込まずに、スクリプトの読み込み関数を差し替えて確かめる。
    `--ad-inset` の設定・解除、ボード画面以外で枠を出さないことも確かめる。
  - E2E（Playwright）: 広告の設定ありでビルドしたアプリに対し、`page.route` で `pagead2.googlesyndication.com` への
    リクエストを横取りし、`<ins>` に `data-ad-status="filled"` を付けて 320×50 の要素を入れる**スタブ**を返す。
    実際の Google には通信しない。確かめる内容は quickstart.md のとおり。
  - 広告ありのビルドは、Playwright の `webServer` に 2 つ目のサーバーとして追加する（テスト用の ID
    `ca-pub-0000000000000000` を渡し、出力先 `dist-ads/`、ポート 4174）。広告のテストは `tests/e2e/ads-*.spec.ts` に置き、
    それだけがこのサーバーを使う。既存のテストは広告なしのビルド（ポート 4173）のまま。
  - 既存の `privacy.spec.ts` は広告の設定なしのビルドで「外部通信ゼロ」を維持する。設定ありのビルドでは、
    外部通信先が `pagead2.googlesyndication.com` などの許可したホストだけで、リクエストの URL・本文にボードのタイトル・
    マスの項目が含まれないことを確かめる（SC-006）。
- **Rationale**: 実際の広告は審査前には出ず、テストで Google に通信すると無効なインプレッションになるため、スタブで確かめる。
