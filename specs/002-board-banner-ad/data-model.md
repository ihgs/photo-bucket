# Data Model: ボード画面の帯広告

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

この機能は**保存するデータを増やさない**。IndexedDB のスキーマ（`boards`・`photos`・`meta`）、
`Preferences`、バックアップ形式（`.pbz`）は変更しないため、スキーマのバージョンもマイグレーションも不要（憲章 VI）。
閉じるボタンを設けない（FR-012）ので、「閉じた時刻」などの記録も持たない。

以下は画面のあいだだけメモリに持つ状態と、ビルド時の設定である。

## AdConfig（ビルド時の設定）

| 項目 | 由来 | 例 | ルール |
|---|---|---|---|
| `client` | `VITE_ADSENSE_CLIENT` | `ca-pub-1234567890123456` | `^ca-pub-\d{16}$` に合わない場合は未設定として扱う |
| `slot` | `VITE_ADSENSE_SLOT` | `1234567890` | `^\d+$` に合わない場合は未設定として扱う |

- `client` と `slot` のどちらかが未設定なら `AdConfig` は `null`（広告機能は無効。枠を出さず、外部スクリプトも読み込まない）。R2。

## AdSlotState（帯広告の枠の状態、メモリのみ）

| 状態 | 意味 | 枠の高さ | `--ad-inset` |
|---|---|---|---|
| `idle` | ボード画面にいない、または広告機能が無効 | 0（DOM に置かない） | なし |
| `loading` | 広告を要求中 | 確保する（約 70px＋セーフエリア） | 枠の高さ |
| `shown` | 広告が表示されている | 確保する | 枠の高さ |
| `hidden` | 出せないと確定（オフライン・失敗・ブロック・在庫なし） | 0 | なし |

### 状態遷移

```text
idle ──(ボード画面を表示 ∧ AdConfig あり ∧ オンライン)──▶ loading
idle ──(ボード画面を表示 ∧ (AdConfig なし ∨ オフライン))──▶ hidden
loading ──(data-ad-status="filled")──────────────────────▶ shown
loading ──(unfilled ∨ スクリプト error ∨ push 例外 ∨ 5 秒で読み込まれない)──▶ hidden
loading / shown ──(offline イベント)──────────────────────▶ hidden
hidden ──(online イベント ∧ ボード画面にいる ∧ AdConfig あり)──▶ loading
（どの状態からでも）──(ボード画面を離れる)──────────────────▶ idle
```

- 「ボード画面」はルート `board`（`#/boards/:id`）と、その上にシートを重ねる `cell`（`#/boards/:id/cells/:r/:c`）。
  `cell` のあいだも状態は保つが、枠はシートの背景に覆われ `inert` になる（research.md R5）。
- `crop`・`export`・`settings`・`list`・`new` に移ると `idle` に戻り、枠（`<ins>`）を DOM から取り除く。

## ボードのデータとの関係

- 帯広告はボード・マス・写真のどのデータも読まない。広告の要求に含まれるのは AdSense のタグが自動で付ける
  ページ URL（`https://…/photo-bucket/` と `#/boards/<ランダムな ID>`。ハッシュはサーバーに送られない）などで、
  ボードのタイトル・マスの項目・写真は含まれない（FR-011、SC-006）。
- `document.title` はアプリ名のまま変えない（ボードのタイトルを入れると広告の要求に含まれうるため）。
