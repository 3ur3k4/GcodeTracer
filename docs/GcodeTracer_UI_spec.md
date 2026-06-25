# Gcode Tracer — UI Design Specification

> **位置づけ**: 本書は要件定義書（`redesign_requirements.md`）に基づき、UIの視覚的・構造的な実装方針を定めた設計仕様書である。実装エージェントはこの文書と要件定義書の両方を参照すること。

---

## 1. 全体レイアウト

### 1.1 ウィンドウ構造

ウィンドウは以下の4レイヤーを縦に積んだ単一ペイン構成とする。

```
┌─────────────────────────────────────────────┐
│ Top Toolbar                          46px   │
├──────────┬──────────────────────────────────┤
│          │                                  │
│   Left   │        Visualizer                │
│   Panel  │                                  │
│  196px   ├──────────────────────────────────┤
│          │  Console Drawer（開閉可能）        │
├──────────┴──────────────────────────────────┤
│ Status Ribbon                        24px   │
└─────────────────────────────────────────────┘
```

- Left Panel の幅: **196px** 固定（折りたたみ機能は持たない）
- Visualizer はLeft Panel・Top Toolbar・Status Ribbonを除いた残余領域をすべて占有する
- Console Drawer は Visualizer の下端に吸着する形で開閉する

### 1.2 重ね合わせ要素

- **Settings Drawer**: Toolbar右端・Visualizer上端に `position: absolute` で表示（右端吸着）
- **Visualizer Overlay**: Visualizer左上に座標・ズーム情報をフローティング表示する

---

## 2. デザイントークン

### 2.1 カラートークン

| トークン | ダークモード | ライトモード | 用途 |
|---|---|---|---|
| `--bg` | `#191919` | `#F2F2EF` | ウィンドウ背景（Visualizer背景を兼ねる） |
| `--surface` | `#222222` | `#FFFFFF` | Left Panel・Toolbar・Ribbon・Consoleの面 |
| `--surface2` | `#2A2A2A` | `#F7F7F4` | ボタンhover背景・入力フィールド背景 |
| `--border` | `#3A3A3A` | `#DEDEDA` | すべての境界線・枠線・グリッド主要線 |
| `--grid-line` | `#2E2E2E` | `#E0E0DC` | Visualizerグリッド補助線 |
| `--tp` | `#FAFAF7` | `#191919` | Primary text |
| `--ts` | `#9A9A9A` | `#6E6E6E` | Secondary text・ラベル・非活性アイコン・未実行パス |
| `--accent` | `#0fd140` | `#0aaa33` | Run状態・進捗バー・Console dot・完了済みパス |
| `--danger` | `#F2675C` | `#D92D20` | Alarm状態・Soft Resetボタン・エラーログ・現在位置マーカー |
| `--warning` | `#F5A623` | `#C77A1F` | Hold状態・Unlockボタン・再開ポイントラベル |

> ライトモードの `--accent` は白背景上でのコントラスト比確保のため `#0aaa33` に調整している。

### 2.2 タイポグラフィトークン

| トークン | 値 | 適用箇所 |
|---|---|---|
| `--font-sans` | IBM Plex Sans | UI全般のラベル・ボタンテキスト |
| `--font-mono` | IBM Plex Mono | 座標値・Console・ステップサイズ・MachineStateラベル・Visualizer座標ラベル |

### 2.3 MachineState セマンティックカラー対応

| State | dot・label color |
|---|---|
| `Idle` | `--ts`（ニュートラル） |
| `Run` | `--accent` |
| `Hold` | `--warning` |
| `Alarm` | `--danger` |

### 2.4 アイコンライブラリ

**Lucide** (`@lucide/vue`) を使用する。`stroke-width: 1.75` をデフォルトとする。

---

## 3. コンポーネント仕様

### 3.1 Top Toolbar

**高さ**: 46px  
**背景**: `--surface`  
**下境界**: `1px solid --border`

#### ボタン配置（左から順）

| ボタン | アイコン | 活性条件 | 動作 |
|---|---|---|---|
| Open File | `FolderOpen` | 常時 | ファイルピッカーを開く |
| Run / Resume | `Play` | 接続済み かつ (一時停止中 または (未実行 かつ ファイル読込済)) | 実行開始 or 一時停止から再開 |
| Pause | `Pause` | `machineState === 'Run'` | Feed Hold |
| Stop | `Square` | `machineState === 'Run' \| 'Hold'` | ジョブキャンセル |
| — | セパレーター(1px) | — | — |
| Soft Reset | `TriangleAlert` | 常時 | `0x18` 送信・color `--danger` |

#### 再開ポイントラベル（Spacer右）

ジョブが途中停止した場合（完走前にcancel/errorで終了）、以下のラベルを Spacer右に表示する：

```
120行目から再開  [✕]
```

- `font-mono`・11px・color `--warning`
- `✕` ボタンクリックで再開ポイントをクリア（次回実行は先頭から）
- ジョブ実行中・完走後・再開ポイントなし時は非表示

#### 進捗エリア（右端、ジョブ実行中のみ表示）

- 進捗バー: 幅110px・高さ2px・color `--accent`
- ラベル: `{currentLine} / {totalLines}`、`font-mono`・11px・color `--ts`

#### ボタン共通仕様

- サイズ: 36px × 34px
- border-radius: 5px
- border: `1px solid --border`
- hover: background `--surface2`
- active: `transform: scale(0.94)`
- disabled: `opacity: 0.3; pointer-events: none`

---

### 3.2 Left Panel

**幅**: 196px  
**背景**: `--surface`  
**右境界**: `1px solid --border`  
**構成（上から）**: MachineState Bar → Coordinate Section → Jog Section

#### 3.2.1 MachineState Bar

**高さ**: 32px  
**padding**: 0 10px  
**下境界**: `1px solid --border`

- 左側: dotインジケーター（6px丸・色はセマンティックカラー対応） + stateラベル（`font-mono`・11px・500weight）

#### 3.2.2 Coordinate Section

**padding**: 8px 10px 6px  
**下境界**: `1px solid --border`

座標テーブルレイアウト:

```
       MPos    WPos       ← col-label: 9px, --ts, 右揃え
X   119.581  119.581      ← axis: font-mono 10px --ts / val: font-mono 13px --tp 右揃え
Y    76.025   76.025
Z     1.038    1.038
```

- グリッド: `grid-template-columns: 10px 1fr 1fr`・gap 4px
- 値フォント: `font-mono`・13px・`--tp`・右揃え
- 軸ラベル: `font-mono`・10px・`--ts`

ゼロ設定ボタン行（座標テーブル下部）:

| ボタン | 送信コマンド |
|---|---|
| `X=0` | `G10 L20 P0 X0` |
| `Y=0` | `G10 L20 P0 Y0` |
| `Z=0` | `G10 L20 P0 Z0` |

#### 3.2.3 Jog Section

**padding**: 8px 10px  
**flex: 1**（残余高さを占有）

**XYグリッド(3×3) + Z軸ボタン 横並び配置**

各Jogボタン: 高さ36px・border-radius 4px・border `1px solid --border`・bg `--surface2`  
`Alarm` 状態中は `pointer-events: none; opacity: 0.4`

**送信コマンド形式**:

```
G91 G0 G21 X{dx} Y{dy}     # XY移動（移動のある軸のみ含む）
G91 G0 G21 Z{dz}            # Z移動
```

- `$J=` GRBL jogコマンドは使用しない（通常G-codeで送信）
- Jogコマンドもコンソールにtx方向でログを記録する

**ステップサイズ行**: `0.1 / 1 / 10 / 100`（mm）

**アクションボタン行**（Jog Section下部）:

| ボタン | アイコン | 送信コマンド |
|---|---|---|
| Unlock | `LockOpen` (`--warning`) | `$X` |
| Home | `Home` | `$H` |
| Go to work zero | `Crosshair` | `G0 X0 Y0 Z0` |

---

### 3.3 Visualizer

**背景**: `--bg`

#### グリッド描画（ワールド座標系・ビューポート追従）

ビューポートのパン・ズームに追従するワールド座標グリッドを Canvas 2D API で描画する。

- 最小グリッド間隔: 画面上40px以上になるよう `niceStep` アルゴリズムで刻み幅(mm)を決定
- 3段階の線種:

| 種別 | 条件 | 色 | 線幅 | 透明度 |
|---|---|---|---|---|
| 原点線 | `idx === 0` (X=0 または Y=0) | `--border` | 1.25px | 1.0 |
| 主要線 | `idx % 5 === 0` | `--border` | 0.75px | 0.5 |
| 補助線 | その他 | `--grid-line` | 0.5px | 1.0 |

- 座標ラベル: 原点線・主要線にのみ表示（補助線は省略）。`font-mono`・10px・color `--ts`
- ダブルクリックで `fitToView()` 実行（ツールパスにフィット）

#### ツールパス描画

- 完了済みパス: color `--accent`・不透明度 0.9・lineWidth 1.5
- 未実行パス: color `--ts`・不透明度 0.4・lineWidth 1.5
- 現在位置マーカー: color `--danger`（4px丸 + 9px クロスヘア）

#### G-codeパーサ（gcodeToPath）対応範囲

- G0/G1（直線移動）、G2/G3（円弧・IJK形式のみ）
- G90/G91（絶対/相対）、G20/G21（インチ/mm）
- 1行に複数のGコード（例: `G91 G0 G21 X10`）を正しく処理する

#### Visualizer Overlay（左上）

```
X  119.581   Y  76.025   Zoom 305%
```

- background: `--surface` 88% opacity
- border: `1px solid --border`・border-radius 5px
- padding: 6px 10px
- フォント: `font-mono`・12px
- ラベル color `--ts`・値 color `--tp`
- `pointer-events: none`

---

### 3.4 Console Drawer

**開状態高さ**: 140px  
**閉状態高さ**: 30px（ヘッダーのみ）  
**背景**: `--surface`  
**上境界**: `1px solid --border`

#### ヘッダー（30px）

- 左: 6px丸dot（`--accent`固定）+ "Console"ラベル（11px・`--ts`・letter-spacing 0.08em・大文字）
- 右: `ChevronDown` アイコン（開状態で180°回転）

#### ログエリア

- padding: 4px 10px
- フォント: `font-mono`・12px・line-height 1.65
- 最大行数: 500行（超過分は先頭から削除）
- 新規行追加時に自動スクロール（最下部へ）

| 行種別 | prefix | color |
|---|---|---|
| 送信（tx）| `> ` | `--ts` |
| 受信（ok等）| `< ` | `--accent` |
| エラー（error:/ALARM:）| `! ` | `--danger` |
| info | なし | `--warning` |

**コンソールに記録される送信コマンド一覧**:

- コンソール入力からの手動送信（`send-command`）
- Jog移動（`G91 G0 G21 X...`）
- ゼロ設定（`G10 L20 P0 X0`等）
- ワークゼロへ移動（`G0 X0 Y0 Z0`）
- ホーミング（`$H`）
- アンロック（`$X`）
- ソフトリセット（`\x18 (soft reset)`）
- ジョブ実行中の各Gコード行

#### 入力行（34px）

- 左: `>` プロンプト（`font-mono`・12px・`--ts`）
- 中: テキスト入力（border none・bg transparent）
- 右: 送信ボタン（Lucide `Send`・hover時 color `--accent`）

---

### 3.5 Status Ribbon

**高さ**: 24px  
**背景**: `--surface`  
**上境界**: `1px solid --border`  
**padding**: 0 10px

```
● /dev/tty.usbmodem1101    ● OSC 192.168.1.10:8000          ⚙
```

| 要素 | 仕様 |
|---|---|
| Serial インジケーター | 5px丸dot + ポート名。接続中: `--accent`・切断中: `--ts` |
| OSC インジケーター | 5px丸dot + `OSC {ip}:{port}` / `OSC off`。有効: `--accent`・無効: `--ts` |
| Settings ボタン | Lucide `Settings`（右端）。クリックでSettings Drawerを開閉 |

テキスト: 10px・`--ts`

---

### 3.6 Settings Drawer

**トリガー**: Top Toolbar の Settings ボタン（右端）  
**表示位置**: `position: absolute; right: 0; top: 0`（Visualizer上端右端に重なる）  
**背景**: `--surface`  
**下境界・左境界**: `1px solid --border`  
**padding**: 10px 14px 12px

#### 内部レイアウト

2カラムグリッド（`1fr 1fr`・gap 14px）

**左カラム: Serial**

| 要素 | 仕様 |
|---|---|
| Port | `<select>`・接続中はdisabled |
| Baud rate | `<select>`・接続中はdisabled |
| Connect / Disconnect | `--accent`背景・color `#111`・width 100% |
| Poll interval | `<select>`（100 / 200 / 250 / 500 / 1000 ms）・未接続時はdisabled・変更即時反映 |

**右カラム: OSC**

| 要素 | 仕様 |
|---|---|
| IP address | `<input type="text">`・変更時に即時反映 |
| Port | `<input type="text">`・変更時に即時反映 |
| Enable | トグルスイッチ（on: `--accent`・off: `--border`） |

閉じるボタン: 右上に Lucide `X`

---

## 4. インタラクション仕様

### 4.1 Run ボタンの活性条件

| 条件 | 結果 |
|---|---|
| 未接続 | disabled |
| 接続済み・ファイル未読込・未実行 | disabled |
| 接続済み・ファイル読込済・未実行 | **active** → クリックで `run-file` dispatch（再開ポイントがあればその行から） |
| 接続済み・一時停止中 | **active** → クリックで `resume` dispatch |
| 実行中（非一時停止） | disabled |

### 4.2 ジョブライフサイクルと再開ポイント

```
ファイル読込
  │
  ▼
[Run] ──────────────────────────────▶ 実行中
                                          │
                        ┌─────────────────┤
                    [Pause]           [Stop / Error]
                        │                 │
                        ▼                 ▼
                     一時停止       途中停止 → resumeFromLine に currentLine を保存
                        │                 │
                    [Run]              [Run] → resumeFromLine 行目から再開
                        │
                        ▼
                      再開 → 継続実行
                                │
                          完走 → resumeFromLine をリセット
```

**新ファイル読み込み時**:
- 実行中・一時停止中でも自動的に `cancel` を呼び出す
- `resumeFromLine` を 0 にリセット

### 4.3 MachineState による UI 連動

| State | Pause ボタン | Stop ボタン | Jog パッド |
|---|---|---|---|
| `Idle` | disabled | disabled | active |
| `Run` | active | active | active |
| `Hold` | disabled | active | active |
| `Alarm` | disabled | disabled | **disabled** |

### 4.4 座標値の更新

- `store.grbl.wpos.x`, `store.grbl.wpos.y`, `store.job.currentLine` の変化のみで Visualizer を再描画する（ポーリング間隔とUI描画を分離）

---

## 5. 実装上の注意事項

### 5.1 CSS 設計

- CSS 変数（トークン）は `src/styles/tokens.css` の `:root` で定義し、`prefers-color-scheme: dark` で上書きする
- コンポーネントの `<style scoped>` 内でトークン以外の生の値を直接記述しない

### 5.2 IPC / Reactive 配列

- Pinia の `ref<string[]>` はリアクティブ Proxy であり、そのまま `ipcRenderer.send` に渡すと Structured Clone エラーになる
- `useIpc.ts` の `runFile()` では `Array.from(lines)` でプレーン配列に変換してから dispatch する

### 5.3 Canvas 描画

- Canvas サイズは `ResizeObserver` でコンテナ変化を検知して更新する
- グリッドの float ドリフトを避けるため、座標は `idx * step` の整数インデックス乗算で算出する（`x += step` の累積加算は使用しない）
- CSS 変数は Canvas 2D の `font` プロパティに直接渡せないため、`getComputedStyle` で解決した実値を使う

### 5.4 gcodeToPath

- `tokenize()` は G コードを複数値の配列として保持し、1行に複数の G コード（`G91 G0 G21 X10`等）を正しく処理する

### 5.5 Electron セキュリティ設定

- `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` を明示設定する
- Preload では `contextBridge.exposeInMainWorld('api', ...)` のみでレンダラーに API を公開する
