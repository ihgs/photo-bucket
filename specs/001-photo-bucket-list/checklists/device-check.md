# Device Check: 写真型バケットリスト

**Purpose**: quickstart.md「3. 実機での確認」の結果を記録する
**Created**: 2026-09-23
**Feature**: [spec.md](../spec.md)

## 自動確認（開発環境で実施済み）

- [x] `npm run lint` — エラー 0 件
- [x] `npm test` — 単体・結合テストすべて成功
- [x] `npm run test:e2e` — Chromium（Pixel 7 相当）と WebKit（iPhone 14 相当）で全シナリオ成功
      （Service Worker を使うオフライン確認とアクセシビリティ検査は Chromium のみ）
- [x] `npm run build` と `node scripts/check-bundle-size.mjs` — 初回読み込み JS 約 26KB（gzip、上限 60KB）

## 実機確認（GitHub Pages 公開後に実施する）

Service Worker は HTTPS でしか動かないため、GitHub Pages に公開したもので確認する。

- [ ] iPhone（iOS Safari）: ホーム画面に追加し、アイコンからブラウザの枠なしで起動する（US4）
- [ ] iPhone: 5×5 のボードを作り、最初の項目を 1 分以内に入力できる（SC-001）
- [ ] iPhone: 「撮影する」で撮った写真を 3 タップ以内・30 秒以内に貼れる（SC-002）
- [ ] iPhone: 機内モードで起動し、写真を貼って画像を保存できる（SC-005）
- [ ] iPhone: 25 マスに写真を貼ったボードで、5 秒以内に共有メニューが開き写真アプリに保存できる（SC-003）
- [ ] Android（Chrome）: 上と同じ手順で同じ結果になる
- [ ] iPhone・Android: 「バックアップを書き出す」で `.pbz` のまま保存・共有でき（拡張子が `.zip` などに変わらない）、そのファイルを「バックアップを読み込む」で選んで復元できる（FR-024）

## Notes

- 実機確認は開発環境からは行えないため未実施。公開後にチェックする。
