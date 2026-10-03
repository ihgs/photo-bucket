# Data Model: ホーム画面への追加を促す案内

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md) | **Date**: 2026-10-03

DB スキーマは変えない（`meta` ストアのキーを 1 つ増やすだけ）。ボード・写真・バックアップファイルは変えない。

## InstallPromptRecord（`meta` ストア、キー `installPrompt`、新規）

| フィールド | 型 | 説明 |
|---|---|---|
| `dismissCount` | `0 \| 1 \| 2` | 案内を閉じた（または追加画面をキャンセルした）回数。2 で打ち止め |
| `lastDismissedAt` | string（ISO 8601）\| null | 最後に閉じた日時 |
| `installed` | boolean | ホーム画面に追加されたことがわかった（ボタン1つで追加できる端末のみ） |

- ない場合は `{ dismissCount: 0, lastDismissedAt: null, installed: false }` とみなす。
- 端末（ブラウザ）ごとの記録で、バックアップには入れない。

### 状態遷移

```text
未表示(0) ──[閉じる／キャンセル]──▶ 1回閉じた(1, 日時) ──[30日経過]──▶ 再表示 ──[閉じる／キャンセル]──▶ 打ち止め(2)
   │                                   │                                        │
   └──────────[追加した]─────────────────┴────────────[追加した]──────────────────┴──▶ 追加済み(installed)
```

## InstallGuide（案内の種類、保存しない）

| 値 | 対象 | 内容 |
|---|---|---|
| `one-tap` | ブラウザの合図を受け取った（Android の Chrome、パソコンの Chrome・Edge など） | 「アプリとして追加」ボタン |
| `ios` | iPhone・iPad の Safari | 共有ボタンからの手順 |
| `ios-other` | iPhone・iPad の Chrome・Edge など | アドレスバーの共有ボタンからの手順 |
| `mac-safari` | Mac の Safari | 「ファイル」→「Dock に追加」 |
| `in-app` | LINE・Instagram・Facebook・X のアプリ内ブラウザ | 普通のブラウザで開き直す案内 |
| `none` | 単独のアプリとして表示中、Firefox、判定できない、合図のない Chromium | 出さない |

- データが引き継がれない種類（引き継ぎの注意の対象）: `ios`・`ios-other`・`mac-safari`（FR-012）。

## 表示の判定

```text
shouldShowBanner(record, guide, now) =
  guide ≠ none
  ∧ ¬record.installed
  ∧ (record.dismissCount = 0 ∨ (record.dismissCount = 1 ∧ now − record.lastDismissedAt ≥ 30 日))
```
