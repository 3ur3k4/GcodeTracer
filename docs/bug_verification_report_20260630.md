# バグ検証・実機確認レポート

**実施日**: 2026-06-30  
**環境**: macOS / 実機プロッター接続済み

---

## 実機確認サマリー

以下の機能を実機で検証した。

| 項目 | 結果 |
|------|------|
| シリアル接続・GRBL Welcome 受信 | ✅ 正常 |
| StatusRibbon への機械状態表示 | ✅ 正常 |
| ジョグ操作（X/Y/Z 各軸） | ✅ 正常 |
| コンソール手入力・コマンド履歴 | ✅ 正常 |
| Gcode ファイル読み込み・テキスト表示 | ✅ 正常 |
| ジョブ実行中の行ハイライト・自動スクロール | ✅ 正常 |
| ジョブ一時停止・再開 | ✅ 正常 |
| StatusRibbon ファイル名クリック（Finder 表示） | ✅ 正常 |
| **一時停止後の停止ボタン** | ❌ バグ検出 → 修正済み |
| **ジョグ後の Work Zero ボタン** | ❌ バグ検出 → 修正済み |

---

## バグ 1: 一時停止後に停止ボタンを押すとコマンドが一切受け付けなくなる

### 現象

1. ジョブ実行中に「一時停止」ボタンを押す
2. 続けて「停止」ボタンを押す
3. 以降、ジョグ・コンソール等すべてのコマンドが無効になる
4. ソフトリセット（Ctrl-X）を実行しないと操作できない状態になる

### 原因

`pause()` ハンドラは `scheduler.feedHold()` で `!`（Feed Hold）をGRBLに送信し、GRBLを Hold 状態にする。しかし `cancel()` ハンドラには GRBL の Hold 状態を解除する処理がなかった。

```
// app.ts (修正前)
cancel() {
  jobRunner?.cancel()
  // GRBLはHold状態のまま → 以降のコマンドを受け付けない
}
```

### 修正

`cancel()` で `scheduler.softReset()` を呼ぶようにした。`softReset()` は `\x18`（ソフトリセット）をGRBLに送信し、Hold → Idle へ遷移させる。同時に scheduler 内部の `inFlight`・`bufferUsed` もリセットされる。

```typescript
// app.ts (修正後)
cancel() {
  jobRunner?.cancel()
  scheduler?.softReset()  // GRBLのHold状態を解除してIdleに戻す
}
```

**修正ファイル**: `electron/app.ts`

---

## バグ 2: ジョグ操作後に Work Zero ボタンを押しても原点復帰しない

### 現象

1. ジョグボタンで軸を移動する
2. 「Work Zero」ボタンを押す
3. 機械が動かない（原点 X0 Y0 Z0 へ移動しない）

### 原因

`jog()` ハンドラが `G91`（相対座標モード）を送信した後、GRBLのモーダル状態を `G90`（絶対座標モード）に戻していなかった。

`gotoWorkZero()` が送信する `G0 X0 Y0 Z0` は絶対座標を前提としているが、モーダル状態が `G91` のままだと「現在位置から相対で 0mm 移動」と解釈されて実質無動作になる。

```typescript
// app.ts (修正前)
jog(x, y, z, stepSize) {
  // ...
  scheduler.enqueue('G91 G0 G21 X1.000')  // G91が残ったまま
}

gotoWorkZero() {
  scheduler.enqueue('G0 X0 Y0 Z0')  // G91状態では相対0移動 = 動かない
}
```

### 修正

① `jog()` でジョグコマンド送信直後に `G90` を enqueue してモーダル状態を絶対座標に戻す（根本修正）。  
② `gotoWorkZero()` も `G90 G0 X0 Y0 Z0` に変更し、明示的に絶対座標モードを指定（防御的修正）。

```typescript
// app.ts (修正後)
jog(x, y, z, stepSize) {
  // ...
  scheduler.enqueue(cmd)
  scheduler.enqueue('G90')  // 絶対座標モードに戻す
}

gotoWorkZero() {
  scheduler.enqueue('G90 G0 X0 Y0 Z0')  // 明示的にG90指定
}
```

**修正ファイル**: `electron/app.ts`

---

## 備考

- 両バグとも `electron/app.ts` の IPC ハンドラ層のみの修正で完結（parser/scheduler/state の各モジュールは変更なし）
- 一時停止→停止のバグは実機でしか検出できない類のもの（ソフトリセット後の挙動はモックで検証不可）
- ジョグ後の G91 残留はユニットテストで検出可能なため、今後テストケース追加を検討すること
