# Quickstart: ホーム画面への追加の案内を確かめる

**Related**: [spec.md](./spec.md) / [contracts/install-banner.md](./contracts/install-banner.md) / [data-model.md](./data-model.md)

## 1. 自動テスト

```bash
npm run lint
npm test
npm run test:e2e
```

| テスト | 確かめること | 関連 |
|---|---|---|
| `tests/unit/install-guide.test.ts`（新規） | ユーザーエージェントと状態ごとの種類（iPhone Safari → `ios`、iPhone Chrome → `ios-other`、iPadOS → `ios`、Mac Safari → `mac-safari`、Mac Chrome（合図なし）→ `none`、Android Chrome（合図あり）→ `one-tap`、LINE・Instagram → `in-app`、Firefox → `none`、単独のアプリ → `none`） | FR-001, FR-004〜FR-006 |
| 〃 | `shouldShowBanner`: 初回は出る、1 回閉じたら 29 日目は出ず 30 日目に出る、2 回閉じたら出ない、追加済みは出ない | FR-007, FR-008, SC-004 |
| `tests/integration/install-record.test.ts`（新規） | 記録の読み書き（ない場合の初期値、閉じる回数は 2 で止まる） | data-model.md |
| `tests/e2e/install-banner.spec.ts`（新規） | Chromium: 合図を疑似的に送ると帯と「アプリとして追加」が出る → 押すと `prompt()` が呼ばれ、`accepted` で帯が消えて再読み込み後も出ない。`dismissed` は閉じたのと同じ | US1 |
| 〃 | WebKit（iPhone）: 手順の帯が出る。ボードがあるときだけ引き継ぎの注意と「バックアップを書き出す」が出る。閉じると再読み込み後も出ない | US2, FR-012 |
| 〃 | `display-mode: standalone` では出ない。ボード画面には出ない | FR-001, FR-003 |
| `tests/e2e/a11y.spec.ts`（変更） | 帯が出た状態のボード一覧で axe の違反がない | FR-010 |

## 2. 実機での確認

1. **iPhone（Safari）**: アプリを初めて開くと帯に手順が出る → 手順どおりに「ホーム画面に追加」できる → ホーム画面から起動すると帯が出ない（SC-001, SC-003）。
2. **iPhone（ボードあり）**: Safari でボードを作ってから帯を見ると、引き継ぎの注意が出る → バックアップを書き出し、追加したアプリで読み込んでボードが移る（SC-006）。
3. **Android（Chrome）**: 帯の「アプリとして追加」→ 追加画面で「インストール」→ ホーム画面にアイコンができ、Chrome で開き直しても帯が出ない（SC-002）。
4. **LINE**: トークにアプリの URL を送ってタップし、アプリ内ブラウザで開き直しの案内が出る。
5. **Mac（Safari）**: 帯に「ファイル → Dock に追加」が出る。追加したアプリに Safari のボードが引き継がれるかを確かめ、research.md R6 に結果を書く。
