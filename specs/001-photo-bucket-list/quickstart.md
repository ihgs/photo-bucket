# Quickstart: 写真型バケットリストの動作確認

**Related**: [spec.md](./spec.md) / [plan.md](./plan.md)

実装が仕様どおりに動くことを、開発環境で確かめる手順。コマンド名は plan.md の構成に合わせて
`package.json` に用意する。

## 前提

- Node.js 24 以上、npm（devcontainer に同梱）
- E2E テスト用ブラウザ: 初回のみ `npx playwright install --with-deps chromium webkit`
- テスト用の写真の再生成（通常は不要）: `node tests/e2e/fixtures/make-fixtures.mjs`（ImageMagick が必要）
- 実機確認用: iPhone（iOS Safari）と Android（Chrome）各 1 台。同じネットワークにつなぐ

## セットアップ

```bash
npm install
```

## 1. 自動テスト

| コマンド | 確かめる内容 | 期待結果 |
|---|---|---|
| `npm run lint` | 型チェックと lint | エラー 0 件 |
| `npm test` | 単体・結合テスト（データモデル、スキーマ移行、レイアウト計算、ストレージ、バックアップの往復） | すべて成功 |
| `npm run test:e2e` | 本番ビルドを `/photo-bucket/` のサブパスで配信し、Chromium と WebKit で主要フローを実行 | すべて成功 |

`npm run test:e2e` は次のシナリオを含む。

1. 3×4 のボードを作り、項目を入力して再読み込みしても残る（US1）。ボードがないときは 4 つの手順の使い方が出て、ボードを作ったあとは出ない（US1/AC6・AC7, FR-028）
2. テスト用画像を貼ると達成数が 1 増え、位置情報付き画像でも保存データに位置情報が残らない（US2, FR-015）
3. 5 種類のマス目サイズそれぞれで画像を書き出し、寸法が [contracts/export-image.md](./contracts/export-image.md) の表と一致する。タイトルありとなしで寸法が変わらない（US3, FR-013）
4. 画面表示と書き出し画像を同じ大きさに縮小して比較し、差が許容範囲内（SC-004）
5. オフラインにして再読み込みし、編集・写真の貼り付け・画像の書き出しができる（US4, SC-005）
6. バックアップ（`.pbz`）を書き出し、データを消去して読み込むと元どおりになる。壊れたファイルでは既存データが変わらない（US5, SC-007, FR-025）

## 2. 手元での起動

```bash
npm run dev        # 開発サーバー（ホットリロード）
npm run build      # 本番ビルド（dist/）
npm run preview    # 本番ビルドを /photo-bucket/ のサブパスで配信
```

`npm run preview -- --host` で起動すると、同じネットワークの実機から開ける。

## 3. 実機での確認

| 手順 | 期待結果 | 関連 |
|---|---|---|
| iPhone の Safari で開き、共有メニューから「ホーム画面に追加」 | アイコンからブラウザの枠なしで起動する | US4 |
| 5×5 のボードを作り、最初の項目を入力する時間を計る | 1 分以内 | SC-001 |
| 「撮影」でその場で撮った写真を貼る | 3 タップ以内・30 秒以内に達成済みになる | SC-002 |
| 機内モードにしてアプリを起動し、写真を貼って画像を保存する | すべてできる | SC-005 |
| 25 マスすべてに写真を貼ったボードで「画像として保存」 | 5 秒以内に共有メニューが開き、写真アプリに保存できる | SC-003 |
| Android の Chrome でも同じ手順を行う | 同じ結果になる | 対象ブラウザ |

> 注意: Service Worker は HTTPS か `localhost` でしか動かない。実機でオフラインやインストールを
> 確かめるときは、GitHub Pages に公開したもの（またはトンネル経由の HTTPS）を使う。

## 4. GitHub Pages への公開

1. リポジトリの Settings → Pages で、Source を「GitHub Actions」にする。
2. `main` に push すると、ワークフローがテスト・ビルド・公開を行う。
3. `https://<user>.github.io/photo-bucket/` を開き、上の「実機での確認」を行う。

リポジトリ名が `photo-bucket` でない場合は、ワークフローの `BASE_PATH` を `/<リポジトリ名>/` に変える。
