# job/

## 責務

- `jobRunner.ts`: Gコードファイルの行送り・一時停止/再開/キャンセル・進捗追跡(`currentLine`/`totalLines`)を担う。
- 進捗の `currentLine` は「ok/errorが返り完了した行数」であり、「送信した行数」ではない。

## やってはいけないこと(不変条件)

- シリアルポートへ直接書き込まないこと。送信は必ず `grbl/scheduler.ts` の `enqueue()` 経由で行う。
- `pause()` は送信済み(ok待ち中)の行を止めない。新規送信のみを止め、`scheduler.ts` 内で未送信のまま残っている行はキューから引き戻す(`clearQueue()`)。
- 進捗(`job`)の状態は `grbl/state.ts` の `setJobProgress()` 経由でのみ更新すること。`jobRunner.ts` 自身が `AppState` を保持・複製しないこと。
