# Quickstart: テンプレートからボードを作る

**Related**: [spec.md](./spec.md) / [contracts/new-board-templates.md](./contracts/new-board-templates.md) / [data-model.md](./data-model.md)

## 1. 自動テスト

```bash
npm run lint
npm test
npm run test:e2e
```

| テスト | 確かめること | 関連 |
|---|---|---|
| `tests/unit/templates.test.ts`（新規） | すべてのテンプレート: 項目数 = マスの数、位置が内側で重複なし、タイトル 1〜60 文字で数字を含まない、カテゴリとサイズが有効、id が重複しない。国内旅行の 12 項目が FR-003 の順。`resolveTemplateTitle` が `{年}` を年に置き換える。`cellsFromTemplate` が新しい id・空のメモ・写真なしのマスを作る | FR-002, FR-003, FR-004, FR-006 |
| `tests/integration/boards-storage.test.ts`（変更） | `createBoard(title, size, cells)` で 1 回で保存され、読み直すと同じマスがある | FR-006 |
| `tests/e2e/templates.spec.ts`（新規） | 国内旅行を選ぶ → タイトル「国内旅行」・3×4・サイズを変えられない → 作ると 12 マスが「行きたい」で入る。一年の目標でタイトルに今年の年。「使わない」に戻すと手で入れたタイトルとサイズに戻る。作ったボードでマスを書き換えられる | US1, US2 |
| `tests/e2e/a11y.spec.ts`（変更） | テンプレートを選んだ状態の「新しいボード」画面で axe の違反がない | 憲章 IV |

## 2. 手元で操作して確かめる

```bash
npm run build && npm run preview
```

1. `http://localhost:4173/photo-bucket/#/new` を開く。
2. 4 つのテンプレートを順に選び、タイトル・サイズ・入る項目が spec.md FR-002・FR-003 のとおりか、文字がマスに収まるかを目で確かめる。
3. 「今年のベストごはん」で作り、写真を貼ってから別の写真に差し替えられ、メモにお店の名前を書けることを確かめる。
4. 機内モードでも 1. 〜 2. ができることを確かめる（SC-004）。
