# Research: 外部のテンプレートを取り込む

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-06

R 番号は plan・contracts・tasks から参照する。

## R1. テンプレートの形式（FR-002）

- **Decision**: JSON とし、マス目を行の配列（2 次元配列）でそのまま書く形にする。詳細は [contracts/template-format.md](./contracts/template-format.md)。

  ```json
  {
    "format": "bucket-grid-template",
    "version": 1,
    "name": "国内旅行",
    "title": "国内旅行",
    "description": "日本の 12 の地方をめぐろう",
    "category": "go",
    "rows": [
      ["北海道旅行", "東北旅行", "関東旅行"],
      ["甲信越旅行", { "title": "北陸旅行", "category": "go" }, null]
    ]
  }
  ```

  - マス目のサイズは `rows` の行数 × 1 行の数で決まる（別に `size` を書かない）。すべての行が同じ数でなければならない
  - 項目は文字列（カテゴリは全体の `category`）か `{ "title", "category" }`。`null` は空のマス
  - カテゴリは `want` / `go` / `eat` / `other` のほか、画面と同じ日本語（やりたい・行きたい・食べたい・その他）も受け付ける。全体の `category` を省くと `want`
  - `description` は省略できる。`format` と `version` は必須
- **Rationale**: 手で書く人（Clarifications: 書き出し機能は作らない）にとって、見た目がマス目と同じ並びになり、行・列の番号を書き間違えることがない。
  位置の重なり・マス目の外という誤りが形式上起きない。エラーの位置も「3 行目 2 列目」とそのまま言える（SC-004）。
- **Alternatives considered**:
  - アプリ内の `BoardTemplate` と同じ `items: [{row, col, title, category}]`（行・列の番号を手で書くのが大変で、重なりやはみ出しの誤りが起きやすいため不採用）
  - CSV や 1 行 1 項目のテキスト（カテゴリ・名前・説明を書く場所がなく、版の管理もできないため不採用）
  - YAML（パーサーの依存が増えるため不採用。憲章 V）

## R2. 形式の検証とエラーの伝え方（FR-004, FR-008, SC-003, SC-004）

- **Decision**: `src/domain/templateFormat.ts` に純粋関数 `parseTemplate(text): { ok: true; template } | { ok: false; errors: string[] }` を作る。
  検証ライブラリは使わず手で書く（既存のバックアップの検証と同じやり方）。
  - 順に確かめる: 大きさ（100 KB = 102,400 バイト以下）→ JSON として読める → `format` → `version`（1 より大きければ「新しい形式」）→ 名前・タイトル・説明 → `rows` の形とサイズ → 各マス
  - 長さの上限: 名前 20 文字、タイトル 40 文字（`BOARD_TITLE_MAX`）、説明 60 文字、項目 60 文字（`CELL_TITLE_MAX`）。文字数は既存の `charLength`（コードポイント単位）で数える。前後の空白は取り除いてから数える
  - マスの誤りは全部集め、最初の 5 件まで表示し、それより多ければ「ほか n 件」と添える。形の誤り（JSON でない・`rows` がない など）はその 1 件だけ
  - 項目が 1 つもない（すべて `null`）は誤り
- **Rationale**: テンプレートを作る人が一度で直せるように、マスの誤りはまとめて見せる。上限は既存のボードの上限とそろえ、
  取り込んだ後でボードの検証に引っかからないようにする。
- **Alternatives considered**: 最初の誤りだけ表示（直すたびに貼り直す手間が増えるため不採用）。zod などの検証ライブラリ（依存が増えるため不採用。憲章 V）

## R3. URL からの読み込み（FR-005〜FR-007, SC-006）

- **Decision**: `src/net/fetchTemplate.ts` を作り、`fetch` で読む（外部と通信するコードはこのファイルだけに置く）。
  - `fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", redirect: "follow", signal })`
    - Cookie などの資格情報を送らない、どのページから来たかを送らない。送るのは URL への GET だけ（FR-006）
  - https 以外（http・data・blob・file・javascript など）は `new URL()` で解釈した `protocol` を見て、読む前に断る
  - 時間切れは `AbortController` と 10 秒の `setTimeout`。ユーザーの「やめる」も同じ `AbortController` で止める
  - 大きさは `Content-Length` が 100 KB を超えていれば読まない。ない場合も本文をストリームで読み、100 KB を超えた時点で止める
  - 失敗の分け方:
    - 読む前に `navigator.onLine === false` → 「通信できないため読み込めませんでした」
    - `fetch` が `TypeError`（CORS で許可されていない・名前解決できない・接続できない は区別できない）→ 「この URL からは読み込めませんでした」
    - HTTP 404 → 「ファイルが見つかりませんでした」、そのほかの 4xx/5xx → 「この URL からは読み込めませんでした（エラー {status}）」
    - 時間切れ → 「時間内に読み込めませんでした」
    - 本文が `<` で始まる（HTML のページ）→ 「テンプレートのファイルではなく Web ページのようです。GitHub なら「Raw」の URL を使ってください」
    - いずれも「中身を貼り付けて取り込むこともできます」を添える
  - 読めた本文は R2 の `parseTemplate` にそのまま渡す（貼り付けと同じ扱い）
- **Rationale**: ブラウザ標準の `fetch` だけで足りる（憲章 V）。静的ホスティングなのでプロキシは置けず（憲章 II）、
  CORS を許可していない公開先は読めない。それは貼り付けで補う（spec の Assumptions）。
  GitHub の raw（`raw.githubusercontent.com`）と Gist の raw（`gist.githubusercontent.com`）は `Access-Control-Allow-Origin: *` を返すので読める。
- **Alternatives considered**:
  - CORS プロキシ（第三者のサーバーに URL を渡すことになり、外部通信が増えるため不採用。憲章 I）
  - GitHub の通常のページ URL（`github.com/.../blob/...`）を raw に自動で書き換える（便利だが、決まりが増える。まずはエラーで案内し、要望があれば足す。憲章 V）

## R4. Service Worker との関係（FR-012）

- **Decision**: 変更しない。今の Service Worker（generateSW）はアプリ自身のファイルを precache するだけで、
  ほかのオリジンへの要求には何もしない（`runtimeCaching` を設定していない）。外部のテンプレートはキャッシュされず、毎回読み込む。
- **Rationale**: 取り込んだテンプレートは保存しない（FR-010）ので、キャッシュも不要。

## R5. 憲章 I の改定（spec の Assumptions）

- **Decision**: 実装の最初のタスクとして、憲章を v1.3.0（MINOR: 例外の追加）に改定する。原則 I の例外に次を加える。

  > ユーザーが自分で入力した URL から、テンプレートを読み込む通信を行ってよい (MAY)。この通信は以下をすべて満たさなければならない (MUST):
  > - ユーザーが URL を入れて読み込みを指示したときだけ行い、自動で行わない。
  > - URL への読み込みの要求だけを送り、Cookie などの資格情報、ボードの内容、写真、その他の端末内のデータを送らない。
  > - 読み込んだ内容は検証してから使い、検証に通らない内容は捨てる。

- **Rationale**: 今の原則 I は外部通信を広告だけに限り、「外部 API 呼び出しを導入する場合は、本憲章の改定を必要とする」としている。
  URL からの読み込みは、ユーザーのデータを外に出さないものの外部通信なので、改定して範囲をはっきりさせる。
- **Alternatives considered**: 貼り付けだけにして URL を外す（改定は不要だが、ユーザーが求めた URL での共有ができなくなるため不採用）

## R6. 画面の構成（FR-001, FR-003, FR-010）

- **Decision**:
  - テンプレートを選ぶシート（`TemplateSheet`）の一覧の下に「テンプレートを取り込む」ボタンを置く。押すと同じシートの中身が取り込み画面に切り替わる（URL は変えない。005 と同じく新しい画面を作らない）
  - 取り込み画面は「URL から」と「中身を貼り付け」の 2 つの欄で、それぞれに「読み込む」「取り込む」ボタンを持つ（どちらを使ったかがはっきりするように）。上に「戻る」
  - `NewBoard` の状態を「テンプレートの id」から「選んだテンプレートそのもの（`BoardTemplate | null`）」に変える。取り込んだテンプレートもアプリに入っているテンプレートも同じ流れで扱える（タイトルの `{年}` の置き換え、サイズの固定、「やめる」での復元、`cellsFromTemplate`）
  - 取り込んだテンプレートは `NewBoard` の状態にだけ持ち、保存しない。シートを開き直しても一覧には出ない（FR-010）
  - 取り込んだテンプレートを選んでいるとき、`TemplatePreview` に「取り込んだテンプレート」と表示する
  - `TemplatePreview` は項目を詰めて並べているので、空のマスがあると位置がずれる。マス目の全マスを並べ、空のマスは「（空き）」と表示する
- **Rationale**: 取り込んだあとの流れを既存のテンプレートと共通にでき、FR-003 の「同じにする」を作りの上でも守れる。
- **Alternatives considered**: 取り込み画面を別のシートとして重ねる（シートが 2 枚重なりフォーカスの管理が複雑になるため不採用）。
  1 つの「取り込む」ボタンで URL と貼り付けを自動で見分ける（両方入っているときに分かりにくいため不採用）

## R7. 取り込んだテンプレートの中身の表示（FR-009）

- **Decision**: Preact の JSX で文字として描くだけにし、`dangerouslySetInnerHTML` は使わない（既存のコードと同じ）。
  取り込んだ文字は、ボード画面・画像の出力でも既存の経路（エスケープされる）を通る。
- **Rationale**: 憲章の技術的制約「`innerHTML` への直接挿入を禁止」を守る。

## R8. テスト

- **Decision**:
  - 単体（Vitest）: `parseTemplate` の正しい例・誤りの例（各ルール）、日本語のカテゴリ、`null` のマス、上限ちょうど・超え、エラーの件数の打ち切り。
    アプリに入っている 4 つのテンプレートを形式で書き直したものが、元と同じ項目になること（形式でアプリのテンプレートも表せることの確認）
  - 単体: 読み込みの失敗の分け方（`fetch` を差し替えて、TypeError・404・500・時間切れ・HTML・大きすぎ・http の URL）
  - E2E（Playwright）: 貼り付けで取り込んでボードを作る、誤りの表示、URL で取り込む（`page.route` で `https://templates.example/…` に CORS ヘッダー付きの応答を返す）、
    CORS なしの応答での失敗表示、オフラインでの貼り付け（Chromium のみ）、アクセシビリティ
  - プライバシー: URL の取り込みで、外に出る要求が入れた URL への GET 1 件だけで、資格情報・Referer がないこと（`page.on("request")` で確かめる）。
    既存の「主な操作で外部通信がない」テストはそのまま通ること
- **Rationale**: 実際の外部サイトに依存せず、CI で決まった結果になる。
