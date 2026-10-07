# Quickstart: 外部のテンプレートを取り込む

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 前提

```bash
npm install
npm run build && npm run preview   # http://localhost:4173/photo-bucket/app/
```

自動テスト:

```bash
npm run lint
npm test                                   # parseTemplate・fetchTemplateText の単体テスト
npx playwright test template-import privacy a11y
```

## 手で確かめる

テンプレートの例は [contracts/template-format.md](./contracts/template-format.md) の「例」を使う。

### 1. 貼り付けで取り込む（US1, SC-001, SC-002）

1. ボード一覧 →「新しいボード」→ 右上の「テンプレート」→「テンプレートを取り込む」
2. 例の JSON を「中身を貼り付け」に貼り付けて「取り込む」
3. 期待: シートが閉じ、「取り込んだテンプレート: 季節の楽しみ」、タイトル「{今年}年 季節の楽しみ」、サイズ 3×3（変えられない）、プレビューの 2 行目 3 列目が「（空き）」
4. 「ボードを作る」→ 8 マスに項目が入り、カテゴリが例のとおり（いちご狩り＝行きたい、かき氷・栗ごはん＝食べたい、ほか＝やりたい）
5. もう一度「新しいボード」→「テンプレート」を開くと、一覧はアプリに入っている 4 つだけで、取り込んだテンプレートは出ない（FR-010）

### 2. 誤りの表示（US1-4, SC-003, SC-004）

例の JSON を次のように変えて貼り付け、表示とボードが増えないことを確かめる。

| 変更 | 期待する表示 |
|---|---|
| 1 行目の 1 マス目を 61 文字にする | 1 行目 1 列目: タイトルは60文字以内にしてください |
| 3 行目から 1 マス消す | 1 行のマスの数がそろっていません（3 行目） |
| `"version": 2` | 新しい形式のため取り込めません。アプリを更新してください |
| 末尾の `}` を消す | テンプレートの形式ではありません（JSON として読めません） |
| すべてのマスを `null` | 項目が 1 つもありません |
| 名前を `<img src=x onerror=alert(1)>` | 取り込め、プレビューにそのままの文字が表示される（スクリプトは動かない。FR-009） |

### 3. URL で取り込む（US2）

1. 例の JSON を GitHub Gist に置き、「Raw」の URL（`https://gist.githubusercontent.com/...`）をコピー
2. 取り込み画面の「URL から」に貼って「読み込む」→ 1 と同じ結果
3. 次の URL で失敗の表示を確かめる（[contracts/import-ui.md](./contracts/import-ui.md) の表）

| URL | 期待 |
|---|---|
| `http://example.com/a.json` | https で始まる URL を入れてください |
| Gist の通常のページ URL（`https://gist.github.com/...`） | この URL からは読み込めませんでした（…許可していないか…） |
| Raw の URL の末尾を変えたもの | ファイルが見つかりませんでした |
| 機内モードで Raw の URL | 通信できないため読み込めませんでした（「オフラインのため…」の案内も出る） |

### 4. オフラインで貼り付け（SC-005）

一度アプリを開いたあと機内モードにし、1 の手順で取り込んでボードを作れる。

### 5. 外に送るものがない（SC-006, FR-006）

Chrome の DevTools の Network で 3 の読み込みを見る。外への要求は入れた URL への GET 1 件だけで、
`Cookie`・`Referer` がなく、本文がないこと。E2E の `privacy.spec.ts` でも確かめる。
