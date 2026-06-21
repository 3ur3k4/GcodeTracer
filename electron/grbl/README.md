# grbl/

## 責務

- `parser.ts`: 受信した生データ(改行区切り)を構造化イベント(ok/error/status/alarm/feedback/welcome)へ変換する唯一の箇所。ステートレス(改行フレーミングのバッファのみ内部に持つ)。
- `state.ts`: `parser.ts` のイベントを集約し `AppState` を保持する唯一の場所(Single Source of Truth)。WCO(ワーク座標オフセット)のキャッシュなど、複数レポートをまたぐ記憶はここが担う。
- `scheduler.ts`: Character-Counting方式のコマンドキュー + リアルタイムコマンド(`?`/`~`/`!`/0x18)の優先送信 + ACKベースのステータスポーリング。
- `errors.ts`: `error:N`/`ALARM:N` を人間可読な説明文に変換する辞書(表示専用)。

## やってはいけないこと(不変条件)

- GRBL応答のパースをこのディレクトリ以外(Renderer側コンポーネント含む)で行わないこと。
- `state.ts` 以外のモジュールが `AppState` を直接保持・複製しないこと。各モジュールは `state.ts` の公開メソッド経由でのみ読み書きする。
- シリアルポートへの書き込みは `scheduler.ts` 以外から行わないこと(Jog/コンソール/ジョブ実行いずれも例外なし)。
- `parser.ts` に状態(WCOキャッシュ等)を持たせないこと。複数レポートをまたぐ記憶は `state.ts` の責務。
