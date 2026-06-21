# ipc/

## 責務

- `gateway.ts`: Renderer⇄Mainの唯一の境界。
  - Renderer→Main: 全メッセージを `shared/ipcContract.ts` の zodスキーマで検証し、不正なメッセージは拒否する。
  - Main→Renderer: `grbl/state.ts` の状態を1本のチャンネルのみで配信する。変更があった場合のみ・間引いて(throttle)push する。

## やってはいけないこと(不変条件)

- 複数のIPCチャンネル・イベント種別をRenderer側で個別購読させる構成にしないこと(状態pushは1本に集約する)。
- zod検証を経由せずに `RendererToMainMessage` を処理しないこと。
- このモジュール以外(`electron/main.ts` 含む)から `ipcMain` を直接操作しないこと。
