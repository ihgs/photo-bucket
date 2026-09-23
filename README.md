# フォトバケットリスト

やりたいこと・行きたいところ・食べたいものをマス目（3×3・4×4・5×5・3×4・4×3）に書き込み、
達成したら写真を貼って、最後にボード全体を一枚の画像として保存・共有できる PWA です。

- データ（項目と写真）はすべて端末内（IndexedDB）に保存され、外部には送信されません。
- ホーム画面に追加でき、一度開いたあとは通信なしですべての機能が使えます。
- 保存画像はボードと同じ縦横比（1:1・縦 3:4・横 4:3）ちょうどで、長辺 2400px です。
- 対象ブラウザ: 最新の iOS Safari、Android Chrome、デスクトップの Chrome・Edge・Safari（Firefox は対象外）。

仕様と設計は [specs/001-photo-bucket-list/](specs/001-photo-bucket-list/) にあります。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run lint       # 型チェック + ESLint
npm test           # 単体・結合テスト（Vitest）
npm run test:e2e   # E2E（Playwright。初回は npx playwright install --with-deps chromium webkit）
npm run build      # 本番ビルド（dist/）
npm run preview    # 本番ビルドを /photo-bucket/ で配信
```

動作確認の手順は [quickstart.md](specs/001-photo-bucket-list/quickstart.md) を参照してください。

## GitHub Pages への公開

1. リポジトリの **Settings → Pages** で、**Source** を「GitHub Actions」にします。
2. `main` ブランチに push すると、`.github/workflows/deploy.yml` が lint・テスト・E2E・ビルドを行い、
   `https://<user>.github.io/photo-bucket/` に公開します。

### リポジトリ名が `photo-bucket` でない場合

公開 URL のパスが変わるため、次の 2 か所を `/<リポジトリ名>/` に変えてください。

- `.github/workflows/deploy.yml` の `BASE_PATH`
- `package.json` の `preview` スクリプトの `--base`（E2E が使う `playwright.config.ts` の `baseURL` も同様）
