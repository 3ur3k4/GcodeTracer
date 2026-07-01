# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-01

### Added
- Electron + Vue 3 + Pinia による GRBL G-code センダー初期構築
- Visualizer: ツールパス描画・軌跡プレビュー（スライダー・前後ステップ）・用紙ガイド・ズーム・テーマ即時切替
- Visualizer: ズーム100%を実寸基準に変更・画面キャリブレーション機能
- Visualizer: プレビュー中の位置情報オーバーレイ反映
- GcodeTextPanel: テキスト検索・行番号ジャンプ・行範囲フィルター
- GcodeTextPanel: 仮想スクロール実装・リサイズパフォーマンス改善
- GcodeTextPanel: ジョブ実行中の行ハイライト・自動スクロール軸トグル
- GcodeTextPanel: 検索バーUI改善
- ConsoleDrawer: リサイズ・スナップ動作・コマンド履歴
- ConsoleDrawer: エラー状態インジケーター・自動スクロール改善
- TopToolbar: ファイル操作グループ集約・破棄ボタン・フルスクリーン初期状態
- TopToolbar: ネイティブタイトルバー廃止・hidden inset スタイル
- TopToolbar: アプリ名を IBM Plex Mono Italic で表示
- TopToolbar: 再開ポイント保存・一時停止ガード
- StatusRibbon: ファイル名クリックで Finder に表示する機能
- CoordinateSection: 座標値フォントサイズ拡大（18px）
- Settings Drawer: フォーム値をストアで永続化・Poll interval デフォルト 100ms
- Jog・座標セクション UI リニューアル
- アプリアイコン・パッケージビルド設定（dmg/zip配布・アドホック署名）
- リサイズ中の描画を rAF スロットルでパフォーマンス改善

### Fixed
- 一時停止後の停止操作・ジョグ後の Work Zero 不動作
- `preload`: `webUtils.getPathForFile` によるファイルパス取得修正
- `serialport` ネイティブモジュールの Electron ビルド不整合

[Unreleased]: https://github.com/3ur3k4/gcode-tracer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/3ur3k4/gcode-tracer/releases/tag/v0.1.0
