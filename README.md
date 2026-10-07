# バケットグリッド

やりたいこと・行きたいところ・食べたいものをマス目（3×3・4×4・5×5・3×4・4×3）に書き込み、
達成したら写真を貼って、最後にボード全体を一枚の画像として保存・共有できる PWA です。

- データ（項目と写真）はすべて端末内（IndexedDB）に保存され、外部には送信されません。
- ホーム画面に追加でき、一度開いたあとは通信なしですべての機能が使えます。
- 保存画像はボードと同じ縦横比（1:1・縦 3:4・横 4:3）ちょうどで、長辺 2400px です。
- 対象ブラウザ: 最新の iOS Safari、Android Chrome、デスクトップの Chrome・Edge・Safari（Firefox は対象外）。

公開 URL のトップ（`/photo-bucket/`）は紹介ページ（`index.html`）で、アプリ本体は `/photo-bucket/app/`（`app/index.html`）です。
ホーム画面に追加されるのはアプリ本体だけで、追加したアプリからは紹介ページは表示されません。

仕様と設計は [specs/001-photo-bucket-list/](specs/001-photo-bucket-list/) にあります。

## テンプレートを作る

「新しいボード」→ 右上の「テンプレート」→「テンプレートを取り込む」から、自分で作ったテンプレートを取り込めます。
テンプレートは次の形式の JSON で書き、中身を貼り付けるか、公開したファイルの URL を入れて取り込みます。
取り込んだテンプレートは端末に保存されません（使うたびに取り込みます）。

### 例

```json
{
  "format": "bucket-grid-template",
  "version": 1,
  "name": "季節の楽しみ",
  "title": "{年}年 季節の楽しみ",
  "description": "春夏秋冬、季節ごとの楽しみを写真に残そう",
  "category": "やりたい",
  "rows": [
    ["お花見をする", { "title": "いちご狩りに行く", "category": "行きたい" }, "潮干狩りをする"],
    ["海で泳ぐ", { "title": "かき氷を食べる", "category": "食べたい" }, null],
    ["紅葉狩りに行く", "お月見をする", { "title": "栗ごはんを食べる", "category": "eat" }]
  ]
}
```

この例は 3×3 で、2 行目 3 列目は空のマスになります。タイトルの `{年}` は、選んだときの年（例: 2026）に置き換わります。

### 項目

| 項目          | 必須 | 決まり                                                                                                                                                         |
| ------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`      | ✅   | 文字列 `"bucket-grid-template"`                                                                                                                                |
| `version`     | ✅   | 整数 `1`。2 以上は「新しい形式のため取り込めません。アプリを更新してください」                                                                                 |
| `name`        | ✅   | テンプレートの名前。1〜20 文字                                                                                                                                 |
| `title`       | ✅   | 作るボードのタイトル。1〜40 文字。`{年}` を含められる                                                                                                          |
| `description` |      | 1 行の説明。0〜60 文字                                                                                                                                         |
| `category`    |      | 文字列で書いた項目のカテゴリ。省くと `want`（やりたい）                                                                                                        |
| `rows`        | ✅   | マス目。行の配列で、各行はマスの配列。サイズは「1 行のマスの数 × 行の数」で、3×3・4×4・5×5・3×4・4×3 のどれか（3×4 は 1 行 3 マス × 4 行）。すべての行が同じ数 |
| `rows[r][c]`  | ✅   | 次のどれか: 文字列（項目のタイトル）／ `{ "title": 文字列, "category": カテゴリ }`／ `null`（空のマス）。タイトルは 1〜60 文字。`null` でないマスが 1 つ以上   |

- カテゴリ: `want`・`go`・`eat`・`other`、または `やりたい`・`行きたい`・`食べたい`・`その他`
- 文字数は前後の空白を除いて数えます。絵文字なども 1 文字と数えます
- 知らない項目（上の表にないもの）は無視します（将来の追加に備えるため）
- ファイル（または貼り付ける文字）は 100 KB 以下にしてください

### URL で取り込めるようにするには

- URL で取り込むには、公開先がほかのサイトからの読み込み（CORS）を許可している必要があります
- 読み込める例: GitHub のリポジトリのファイルの「Raw」の URL（`https://raw.githubusercontent.com/...`）、GitHub Gist の「Raw」の URL（`https://gist.githubusercontent.com/...`）
- 読み込めない公開先でも、ファイルの中身をコピーして「中身を貼り付け」で取り込めます

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run lint       # 型チェック + ESLint
npm test           # 単体・結合テスト（Vitest）
npm run test:e2e   # E2E（Playwright。初回は npx playwright install --with-deps chromium webkit）
npm run build      # 本番ビルド（dist/）
npm run preview    # 本番ビルドを /photo-bucket/ で配信（アプリは /photo-bucket/app/）
```

動作確認の手順は [quickstart.md](specs/001-photo-bucket-list/quickstart.md) を参照してください。

## GitHub Pages への公開

1. リポジトリの **Settings → Pages** で、**Source** を「GitHub Actions」にします。
2. `main` ブランチに push すると、`.github/workflows/deploy.yml` が lint・テスト・E2E・ビルドを行い、
   `https://<user>.github.io/photo-bucket/` に公開します。

### リポジトリ名が `photo-bucket` でない場合

公開 URL のパスが変わるため、次の 2 か所を `/<リポジトリ名>/` に変えてください。

- `.github/workflows/deploy.yml` の `BASE_PATH`
- `package.json` の `preview` スクリプトの `--base`（E2E が使う `playwright.config.ts` の `baseURL` と `webServer.url` も同様。`baseURL` は `/<リポジトリ名>/app/`）
