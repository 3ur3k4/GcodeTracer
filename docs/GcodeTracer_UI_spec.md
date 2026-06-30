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
│  230px   ├──────────────────────────────────┤
│          │  Console Drawer（開閉可能）        │
├──────────┴──────────────────────────────────┤
│ Status Ribbon                        24px   │
└─────────────────────────────────────────────┘
```

- Left Panel の幅: **230px** 固定（折りたたみ機能は持たない）
- Visualizer はLeft Panel・Top Toolbar・Status Ribbonを除いた残余領域をすべて占有する
- Console Drawer は Visualizer の下端に吸着する形で開閉する

**ウィンドウクロム（macOS）**

- `titleBarStyle: 'hiddenInset'`・`trafficLightPosition: { x: 12, y: 15 }` を使用し、ネイティブタイトルバーを非表示にしてコンテンツをウィンドウ上端まで広げる
- トラフィックライトボタンは Top Toolbar に垂直中央揃えで重なる
- Top Toolbar に `-webkit-app-region: drag` を設定してドラッグ移動を可能にする。toolbar 内の `<button>` / `<input>` には `no-drag` を付与してクリックを阻害しない
- フルスクリーン時はトラフィックライトが消えるため、Main process の `enter-full-screen` / `leave-full-screen` イベントを `IPC_CHANNELS.fullscreenChanged` チャンネルで Renderer に通知し、アプリ名の位置を切り替える

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
| `--danger` | `#E73427` | `#D92D20` | Alarm状態・Soft Resetボタン・エラーログ・現在位置マーカー |
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
**レイアウト**: フラット flex・`align-items: center`・`gap: 8px`（全要素間均一）・右 padding のみ 8px

#### ボタン配置（左から順）

| 要素 | アイコン / 内容 | 活性条件 | 動作 |
|---|---|---|---|
| アプリ名 | `"Gcode Tracer"` テキスト・16px bold | — | クリック不可。通常時は `padding-left: 100px`（トラフィックライト分の余白）+ 右 padding でセパレーターの位置を調整。フルスクリーン時は padding をリセットし `width: 230px; text-align: center` でサイドパネル上に中央揃え |
| — | セパレーター (1px × 24px) | — | アプリ名の直後。Left Panel 幅(230px)に揃う位置 |
| Open File | `FolderOpen` | 常時 | ファイルピッカーを開く |
| Discard File | `X` | ファイル読込済 かつ 未実行 | `gcodeFileStore.clear()` を呼び出し、読込済みファイルを破棄して白紙状態に戻す |
| G-CODE パネル | `FileCode2` | ファイル読込済 | Gコードテキストパネルのトグル。アクティブ時は color `--accent` |
| — | セパレーター (1px × 24px) | — | ファイル操作グループとジョブ制御グループの区切り |
| Run / Resume | `Play` | 接続済み かつ (一時停止中 または (未実行 かつ ファイル読込済)) | 実行開始 or 一時停止から再開 |
| Pause | `Pause` | `machineState === 'Run'` | Feed Hold |
| Stop | `Square` | `machineState === 'Run' \| 'Hold'` | ジョブキャンセル |
| — | セパレーター (1px × 24px) | — | — |
| Home | `Home` | 接続済み | `$H` ホーミング |
| Lock / Unlock | `Lock`(Alarm時) / `LockOpen`(それ以外) | 接続済み | Alarm状態時に `$X` アンロック。非Alarm時はクリック無効 |
| — | セパレーター (1px × 24px) | — | — |
| Soft Reset | `TriangleAlert` | 常時 | `0x18` 送信 |
| — | Spacer（flex: 1） | — | 右側要素を右端に押し出す |
| Settings | `Settings` | 常時 | Settings Drawer のトグル |

- **Run ボタン**: 塗りつぶしスタイル（bg `--accent`・border `--accent`・icon color `--surface`）
- **Soft Reset ボタン**: 塗りつぶしスタイル（bg `--danger`・border `--danger`・icon color `--surface`）
- **Lock/Unlock ボタン**: `machineState === 'Alarm'` 時は `--warning` border+color で `Lock` アイコン。それ以外は `LockOpen` アイコンをデフォルトスタイルで表示
- **G-CODE パネルボタン・Settings ボタン**: アクティブ時（パネル表示中）は color `--accent`（塗りつぶしではなくアイコン色のみ変化）
- **Discard File・G-CODE パネルボタン**: ファイル未読込時も常時表示し、`disabled`（`opacity: 0.3`）で非活性とする。`v-if` による表示/非表示切替は行わない（後述のボタン不動原則を参照）
- 全ボタンに `AppTooltip` を適用し、ホバー500ms後にツールチップを表示。Gコードコマンドを送信するボタンにはサブテキスト（コマンド文字列）も表示

#### ボタン配置の不動原則

Toolbar のボタンは `v-if` による出し入れを原則として行わない。Toolbar は緊急性の高い操作（Stop・Soft Reset 等）やアクセス頻度の高い操作が集まる場所であり、ボタン位置が状態によって移動すると操作ミスを招く恐れがある。条件付き表示が必要な場合は `disabled` + `opacity` による非活性表示を使い、位置は常に固定する。

例外: 再開ポイントラベル・進捗エリアはステータス表示領域（Spacer 右）に収まり、ボタン群の位置に影響しないため `v-if` を使用している。

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
- ラベル: `{percent}% ({currentLine} / {totalLines})`、`font-mono`・11px・color `--ts`

#### ボタン共通仕様

- サイズ: **36px × 36px（正方形）**
- border-radius: 5px
- border: `1px solid --border`
- hover: background `--surface2`
- active: `transform: scale(0.94)`
- disabled: `opacity: 0.3; pointer-events: none`

---

### 3.2 Left Panel

**幅**: 230px  
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

レイアウト: `grid-template-columns: 3fr 1fr`・gap 3px。XYグリッドは3列・Z軸は flex column で上下端揃え（`justify-content: space-between; align-self: stretch`）。

各Jogボタン: `aspect-ratio: 1`（正方形・幅100%）・border-radius 4px・border `1px solid --border`・bg `--surface2`  
アイコンサイズ: 20px・stroke-width 1.5  
`Alarm` 状態中は `pointer-events: none; opacity: 0.4`

**送信コマンド形式**:

```
G91 G0 G21 X{dx} Y{dy}     # XY移動（移動のある軸のみ含む）
G91 G0 G21 Z{dz}            # Z移動
```

- `$J=` GRBL jogコマンドは使用しない（通常G-codeで送信）
- Jogコマンドもコンソールにtx方向でログを記録する

**ステップサイズ行**: `0.1 / 1 / 10 / 100`（mm）+ カスタム入力欄（数値入力・44px幅・placeholder `…`）
- プリセットボタンまたはカスタム入力が選択された方がハイライト表示
- カスタム入力は `change` / `Enter` でステップサイズを確定

**アクションボタン行**（Jog Section下部）:

| ボタン | アイコン | 送信コマンド |
|---|---|---|
| Go to work zero | `Crosshair` + "Work Zero" ラベル | `G0 X0 Y0 Z0` |

> Home・Unlock ボタンは **Top Toolbar に移動**した。

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
- ダブルクリックで `fitToView()` 実行（ツールパスにフィット）。ツールパスが空の場合は GRBL 座標原点 (0,0) を左下に配置（scale=1、左下 `PADDING_PX` マージン）

#### ツールパス描画

**通常モード（ジョブ実行進捗に連動）**

| 種別 | 条件 | 色 | 線種 | lineWidth | 不透明度 |
|---|---|---|---|---|---|
| 描画パス（G1）完了済み | `!rapid && done` | `--accent` | 実線 | 1.5 | 0.9 |
| 描画パス（G1）未実行 | `!rapid && !done` | `--accent` | 実線 | 1.5 | 0.4 |
| 移動パス（G0/rapid）完了済み | `rapid && done` | `--rapid-path` | 破線 [4,4] | 1.0 | 0.7 |
| 移動パス（G0/rapid）未実行 | `rapid && !done` | `--rapid-path` | 破線 [4,4] | 1.0 | 0.25 |

**プレビューモード（スライダー位置に連動）**

通常モードと同じセグメント種別・色を使用しつつ、コントラストを強調する。

| 種別 | lineWidth | 不透明度 |
|---|---|---|
| 描画パス 完了済み | 2.0 | 1.0 |
| 描画パス 未実行 | 1.5 | 0.12 |
| 移動パス 完了済み | 1.0 | 0.8 |
| 移動パス 未実行 | 1.0 | 0.08 |

- `--rapid-path`: ライト `#6b9bd2` / ダーク `#4a7fc1`
- 現在位置マーカー: color `--danger`（4px丸 + 9px クロスヘア）、常時表示
- プレビューヘッドマーカー: プレビューモード時のみ、スライダー位置に対応するツールパス終点に `--accent` 色のひし形（5px）を表示

#### Visualizerコントロール（右上フローティング）

高さ 28px で統一。`gap: 4px` で横並び。

| 要素 | アイコン | 動作 |
|---|---|---|
| 100% ボタン | `SquareEqual` | ズームを scale=1・offsetX/Y=canvas中央にリセット |
| フィットボタン | `Group` | ツールパスの描画範囲にフィット（ダブルクリックと同等） |
| プレビューボタン | `SlidersHorizontal` | 軌跡プレビューモードのトグル。ファイル読込済み時のみ表示。アクティブ時は背景を `--accent`・アイコンを `--bg` に反転（塗りつぶしスタイル）。再度押すと解除 |
| 用紙ガイド | `Frame` + `AppSelect` | 用紙サイズ選択（なし/A3横/A3縦/A4横/A4縦/A5横/A5縦/カスタム）。選択時は原点(0,0)を左下として正方向に用紙サイズの破線矩形（`--warning`色・半透明塗り）を描画。カスタム選択時はW×H数値入力欄を表示 |

- ズーム感度: wheel 1段あたり約6%（zoomFactor `1.06`）

#### プログレスオーバーレイ（下部中央、ジョブ実行中のみ表示）

- 幅120px・高さ3px の進捗バー + `{percent}%` テキスト
- position: fixed 下部中央
- 背景: `--surface`・opacity 0.9

#### プレビューバー（下端・プレビューモード時のみ表示）

```
[‹]  ──────────────●────────────────  [›]   42 / 120
```

- 位置: `position: absolute; bottom: 0; left: 0; right: 0`
- 高さ: 36px・背景 `--surface`・上境界 `1px solid --border`
- `‹`（`ChevronLeft`）/ `›`（`ChevronRight`）: 24px 正方形ボタン。border `1px solid --border`・bg `--surface2`。端に達したとき（0 / max）はdisabled（opacity 0.3）
- スライダー: `<input type="range">` flex:1・`accent-color: --accent`。0〜Gコード行数を範囲とし、`sourceLine` 基準でセグメントの done/not-done を切り替える
- カウンター: `{previewLine} / {totalLines}`・`font-mono`・11px・`--ts`・右揃え

**ステップ移動ロジック**:
- `›`（次へ）: セグメントが存在する行番号リストから `previewLine` 以上の最小値を探し `+1` してセット。末尾の場合は行数の最大値へ
- `‹`（前へ）: セグメントが存在する行番号リストから `previewLine` 未満の最大値を探してセット。先頭の場合は 0 へ
- 空行・コメント行はスキップされ、実際に移動コマンドを持つ行を1つずつ追える

#### マウスカーソル

- Visualizer canvas 上では常に `cursor: move`

---

### 3.7 Gコードテキストパネル

**トリガー**: Top Toolbar のファイルグループ内 `FileCode2` ボタン（Open File・Discard File の右隣）。ファイル読込済み時のみ活性。アクティブ時はアイコンを `--accent` 色で表示  
**表示位置**: Visualizer の右端に並置（Visualizer 幅を押し縮める）  
**デフォルト幅**: 280px・左端ドラッグで 180px〜600px に可変  
**背景**: `--surface`  
**左境界**: `1px solid --border`

#### ヘッダー（32px）

- 左: "G-CODE" ラベル（`font-mono`・10px・`--ts`・letter-spacing 0.08em）
- 中: ファイル名（`font-mono`・10px・`--ts`・opacity 0.6・省略表示）
- 右: 🔍 検索ボタン（Search アイコン・24px 正方形、**トグル動作**: 押すと検索バー開閉・アクティブ時 `--accent` 反転）・`×` 閉じるボタン（24px 正方形）

#### 検索バー（`searchBarOpen` が true の場合にヘッダー直下に表示）

2行構成。検索ボタン（トグル）・`⌘F` で開閉、`Esc` でも閉じる。

**Row 1 — テキスト検索（高さ 34px）**

- 🔍 アイコン + テキスト入力（`font-mono` 11px・高さ 24px）
- マッチカウント表示（`N/M` 形式、0 件時は "0件"）
- 前へ（ChevronUp）/ 次へ（ChevronDown）ボタン（各 24px 正方形）
- `Enter` → 次のマッチへ、`⇧Enter` → 前のマッチへ
- 閉じるボタンは Row 1 には置かない（検索ボタントグルで開閉）

**Row 2 — 行番号ジャンプ + 行範囲フィルター（高さ 32px）**

- "L" ラベル（幅 16px・`text-align: center`）+ 行番号入力（52px・高さ 24px）+ CornerDownLeft ボタン（24px 正方形）
- "L" ラベル幅は Row 1 の 🔍 アイコン幅（16px）と揃え、入力欄の左端を上段と統一する
- 仕切り線
- 開始行入力（44px）・`〜`・終了行入力（44px）・各高さ 24px
- 範囲指定中のみ `×` クリアボタン（24px 正方形）を表示

**検索ハイライトスタイル**

| 状態 | スタイル |
|---|---|
| マッチ行 | 行背景 `#e8a020` 6% |
| 現在マッチ行 | 行背景 `#e8a020` 14% |
| マッチ箇所（`<mark>`） | 背景 `#e8a020` 45%・`border-radius: 2px` |
| `future` かつマッチ行 | `opacity: 1`（`future` の opacity 0.35 を上書き） |

プレビュー中の未描画行（`future`）であっても、検索マッチ行は通常の配色で表示する（`opacity` を上書きすることで実現）。

行範囲フィルターが有効な場合、範囲外の行は DOM から非表示（`visibleLineItems` で除外）となるため、`scrollToLine` は `visibleLineItems` 内での DOM 位置で検索する。

#### ライン一覧

大規模ファイル（1万行超）での DOM 肥大を避けるため**仮想スクロール**を実装する。

- 行の高さ: **固定 22px**（`height: 22px; box-sizing: border-box`）— 仮想スクロールの計算基準。CSS と `LINE_H` 定数を必ず一致させること
- DOM に存在する行は「表示領域 ÷ 22px + バッファ 8行」のみ（常時 ~40 行程度）
- スクロール位置に応じて仮想ラッパーの `paddingTop` / `paddingBottom` を更新し、スクロール量とスクロールバー位置を正確に維持する
- `scrollToLine()` は `scrollIntoView` を使わず、`listRef.scrollTop` を直接計算して設定する
- 各行: 行番号（右揃え 34px・10px mono・`--ts` opacity 0.5） + コード本文（12px mono）
- 左端 3px のボーダー（透明 / 完了色）でハイライトを示す

**シンタックスハイライト**

| トークン種別 | 対象 | 色 |
|---|---|---|
| `tok-g` | G コード（G0、G1、G90 等） | `--accent` |
| `tok-m` | M コード（M3、M5 等） | `--warning` |
| `tok-coord` | 軸ワード（X/Y/Z/I/J/K/F/S/R 値） | `--tp` |
| `tok-comment` | `(...)` / `;` コメント | `--ts`・italic |
| `tok-plain` | その他 | `--tp` opacity 0.75 |

**行の状態とスタイル**

`lineState()` は複数クラスを同時に付与できる `Record<string, boolean>` を返す。

| 状態 | 適用条件 | スタイル |
|---|---|---|
| `head` | プレビュー時の最終完了行（index = previewLine − 1） | 左ボーダー `--accent`・背景 accent 8% |
| `current` | ジョブ実行中・ok受信済みの最終行（index = job.currentLine） | 左ボーダー `--accent`・背景 accent 14% |
| `inflight` | GRBLバッファ内の行（currentLine < index < sentLine） | 背景 accent 6%・opacity 0.7 |
| `done` | ok受信完了済み行（index < currentLine） | 通常スタイル |
| `future` | 未送信行（index ≥ sentLine） | opacity 0.35 |
| `match` | 検索クエリにマッチする行 | 背景 `#e8a020` 6% |
| `current-match` | 現在フォーカスされているマッチ行 | 背景 `#e8a020` 14% |

`sentLine` は `jobRunner` が `scheduler.enqueue()` の `onSend` コールバック経由で更新する実送信行数（1-based）。`scheduler.pump()` が実際に `transport.write()` した瞬間にインクリメントされるため、127バイトバッファの充填状況をリアルタイムに反映する。

**ヘッダー: 自動スクロールトグル**

ジョブ実行中 / 一時停止中のみ、ヘッダーに `OK` / `TX` のセグメントトグルを表示する。

| ボタン | 追従する行 | 備考 |
|---|---|---|
| `OK` | `job.currentLine`（ok受信済み最終行） | デフォルト |
| `TX` | `job.sentLine - 1`（最後に実際に送信した行） | |
| ―（両方非アクティブ） | 追従なし | アクティブ中のボタンを再押しで切り替え |

追従スクロールは常に**ビューポート中央**を目標位置とする（`scrollTop = itemTop − clientHeight/2 + LINE_H/2`）。

**インタラクション**

- 行クリック → `gcodeFile.setPreviewLine(index + 1)` を呼び、プレビューモードを ON にしてビジュアライザーと連動
- プレビュースライダー操作 → テキストパネルが head 行に自動スクロール（`block: 'nearest'` 相当の最小スクロール）
- ジョブ実行中: `followMode` に応じて `job.currentLine` または `job.sentLine` の変化を監視し、対象行をビューポート中央へ自動スクロール（プレビューモード OFF 時のみ）
- トグル切り替え時 → 即座に対象行へスクロール

**状態の共有（アーキテクチャ）**

`previewActive` / `previewLine` / `toolPath` / `segmentLines` は `gcodeFileStore` で保持し、VisualizerPanel と GcodeTextPanel が同一の状態を参照する。`gcodeToPath` の二重呼び出しを防ぐ。

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

**高さ**: Visualizerとの境界をドラッグで可変。境界線は高さ3pxの `--border` 色バー（`cursor: ns-resize`）  
**背景**: `--surface`  
**上境界**: `1px solid --border`

**リサイズ・スナップ挙動**:
- 境界線は常時表示（最小化中も消えない）し、常にドラッグ可能
- 下方向ドラッグで `CONSOLE_H_MIN`（40px）を下回ったとき最小化（ヘッダーのみ 30px）にスナップ
- 最小化中に上方向へ 20px 以上ドラッグするとオープンにスナップ（高さ `CONSOLE_H_MIN` で開き、そのまま高さ調整可能）
- ヘッダークリックで開いた場合、`consoleH < 160px` のときはデフォルト高さ 160px で開く
- `consoleOpen` は App.vue が単一の真実の源とし、ConsoleDrawer は `v-model` で双方向同期（リサイザー操作とヘッダークリックが常に一致）

#### ヘッダー（30px）

- 左: 6px丸dot（`--accent`固定）+ "Console"ラベル（11px・`--ts`・letter-spacing 0.08em・大文字）
- 右: `ChevronDown` アイコン（開状態で180°回転）

#### ログエリア

- padding: 4px 10px
- フォント: `font-mono`・12px・line-height 1.65
- 最大行数: 500行（超過分は先頭から削除）
- 新規行追加時に自動スクロール（最下部へ）
- `ok` のみのレスポンスで直前に tx 行が存在する場合は非表示（冗長な確認OKを隠す）
- ログテキストは `user-select: text` で範囲選択・コピー可能

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
- **コマンド履歴**: 送信済みコマンドを最大100件保持。↑キーで過去コマンドを遡り、↓キーで戻る。履歴を辿り始める前の入力内容は保持され、↓キーで最新まで戻ると復元される。直前と同一コマンドは重複登録しない

---

### 3.5 Status Ribbon

**高さ**: 30px  
**背景**: `--surface`  
**上境界**: `1px solid --border`  
**padding**: 0 10px

```
● /dev/tty.usbmodem1101    ● OSC 192.168.1.10:8000          tree_L_A5_04.gcode  1,234 lines
```

| 要素 | 仕様 |
|---|---|
| Serial インジケーター | 6px丸dot + ポート名。接続中: `--accent`・切断中: `--ts` |
| OSC インジケーター | 6px丸dot + `OSC {ip}:{port}` / `OSC off`。有効: `--accent`・無効: `--ts` |
| Spacer | `flex: 1` でファイル情報を右端に押し出す |
| ファイル情報 | 右端に表示。ファイル読込済み時: ファイル名（`--tp`・`font-mono`・最大260px省略）+ 行数（`N,NNN lines`・`--ts` opacity 0.5）。未読込時: "No file loaded"（`--ts` opacity 0.5） |

**ファイル名クリック動作**:
- ファイルパスが既知の場合（`gcodeFileStore.filePath` が空でない場合）、ファイル名は `cursor: pointer` かつホバー時 color `--accent` で表示
- クリックすると `shell.showItemInFolder(filePath)` を呼び出し、Finder でファイルの場所を表示する
- ファイルパスの取得には `webUtils.getPathForFile(file)`（Electron 32+ で `file.path` の代替として導入）を使用し、preload で `window.api.getPathForFile(file)` として公開する

テキスト: 12px・`--ts`

---

### 3.6 Settings Drawer

**トリガー**: Top Toolbar の Settings ボタン（右端）  
**表示位置**: `position: absolute; right: 0; top: 0`（Visualizer上端右端に重なる）  
**幅**: 240px 固定  
**背景**: `--surface`  
**下境界・左境界**: `1px solid --border`  
**padding**: 10px 14px 12px

#### 内部レイアウト

縦積み（`flex-direction: column`・gap 14px）。Serial セクションの下に `1px solid --border` の区切り線を挟んで OSC セクションを配置する。

**Serial セクション**

| 要素 | 仕様 |
|---|---|
| Port | `AppSelect`・接続中はdisabled・ラベル右端に ↺ リロードボタン。Arduino/WCH製造元のポートは `★` バッジ付きで最上位に表示 |
| Baud rate | `AppSelect`・接続中はdisabled |
| Connect | bg `--accent`・color `--surface`・width 100% |
| Disconnect | bg `--danger`・color `--surface`・width 100%（接続中に表示） |
| Poll interval | `AppSelect`（10 / 20 / 50 / 100 / 200 / 500 / 1000 ms）・未接続時はdisabled・変更即時反映 |

**OSC セクション**

| 要素 | 仕様 |
|---|---|
| IP address | `<input type="text">`・変更時に即時反映 |
| Port | `<input type="text">`・変更時に即時反映 |
| Enable | トグルスイッチ（on: `--accent`・off: `--border`） |

- Settings Drawer 外の領域をクリックすると Drawer が閉じる
- 閉じるボタン: 右上に Lucide `X`

#### AppSelect ドロップダウン挙動

- ドロップダウンの `maxWidth` はビューポート右端までの残余幅に制限し、画面外へのはみ出しを防ぐ
- オプションテキストが幅を超える場合は `text-overflow: ellipsis` で省略する

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

### 5.0 リサイズハンドル設計ガイドライン

パネル間の境界ドラッグハンドルは以下のスタイルで統一する。新たにリサイズ可能な境界を追加する場合も同じ仕様に従うこと。

| プロパティ | 値 |
|---|---|
| 通常時 background | `var(--border)` |
| hover/active 時 background | `var(--accent)` |
| hover/active 時 opacity | `0.4` |
| カーソル | 水平境界: `ns-resize` / 垂直境界: `ew-resize` |

- 常時 `--border` 色で細線として視認可能にし、hover 時にアクセント色で強調する
- `user-select: none` を設定してドラッグ中のテキスト選択を防ぐ

**リサイズ中の Vue 再描画抑制**

大量の DOM 要素を持つパネル（GcodeTextPanel 等）では、`pointermove` のたびに Vue のリアクティブ ref を更新すると仮想 DOM の差分計算が毎フレーム走り重くなる。そのため以下のパターンを採用する:

- ドラッグ中: `panelEl.style.width` を直接書き換え（Vue の再描画を発生させない）
- `pointerup` 時: ref を一度だけ更新して Vue の状態を同期する

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
- **テーマ切り替え対応**: `window.matchMedia('(prefers-color-scheme: dark)')` の `change` イベントを購読し、OS のライト/ダーク切り替え時に即座に `draw()` を呼び出す。購読はコンポーネントの `onBeforeUnmount` で解除する
- **高DPI（Retina）対応**: `resizeCanvas()` では `canvas.width/height` を `container.clientWidth/Height × devicePixelRatio` で設定し、`ctx.scale(devicePixelRatio, devicePixelRatio)` で描画座標系を CSS ピクセルに合わせる。描画・レイアウト計算では `canvas.clientWidth/clientHeight`（CSS ピクセル）を参照し、`canvas.width/height`（物理ピクセル）は参照しない

### 5.4 gcodeToPath

- `tokenize()` は G コードを複数値の配列として保持し、1行に複数の G コード（`G91 G0 G21 X10`等）を正しく処理する

### 5.5 Electron セキュリティ設定

- `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` を明示設定する
- Preload では `contextBridge.exposeInMainWorld('api', ...)` のみでレンダラーに API を公開する
- Electron 32 以降、`<input type="file">` で取得した `File` オブジェクトの `file.path` プロパティは廃止された。ファイルの実パスが必要な場合は preload で `webUtils.getPathForFile(file)` を呼び `window.api.getPathForFile(file)` として公開すること

### 5.6 アプリアイコン

- アイコンファイルは `build/icon.icns` に配置する
- **セーフマージン**: 元素材の周囲に **10%** のマージンを設けてアイコンを縮小配置する（アイコンのコンテンツが Dock 上で過大に見えることを防ぐため）
- **カラープロファイル**: 元素材が Display P3 プロファイルを持つ場合、画像処理時にプロファイルを保持して保存すること（Pillowで処理する場合は `icc_profile=img.info.get("icc_profile")` を `save()` に渡す）。プロファイルを落とすと sRGB 解釈され色がくすむ
- `BrowserWindow` の `icon` オプションと `app.dock.setIcon()` の両方に設定する。`dock.setIcon()` は `app.whenReady()` 内で呼ぶ（dev環境でも反映させるため）
- `serialport` はネイティブアドオンのため、electron-builder の `asarUnpack` に含める

### 5.7 パッケージビルド

```bash
npm run package   # vite build → electron-builder (release/mac-arm64/ に .app 生成)
```

- electron-builder の設定は `package.json` の `"build"` フィールドで管理する
- `serialport` / `@serialport` は `files` と `asarUnpack` の両方に列挙する（asar 内に含めると native addon の prebuild 解決が壊れる）
- コード署名なしでビルドする場合、electron-builder が警告を出すが動作には支障なし
