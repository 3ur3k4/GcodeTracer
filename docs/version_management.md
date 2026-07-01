# バージョン管理運用書

Gcode Tracer プロジェクトのバージョン管理・リリース運用ルールをまとめたドキュメント。

---

## 1. バージョン番号の体系

[Semantic Versioning 2.0.0](https://semver.org/lang/ja/) に従う。

```
MAJOR.MINOR.PATCH
例: 1.2.3
```

| 番号 | 上げるタイミング | 例 |
|---|---|---|
| **MAJOR** | 後方互換性のない変更（既存ファイル形式の破壊的変更など） | `0.x.x → 1.0.0` |
| **MINOR** | 後方互換性を保った機能追加 | `0.1.0 → 0.2.0` |
| **PATCH** | バグ修正のみ | `0.1.0 → 0.1.1` |

### MAJOR=0 期間（プレ安定版）について

現在は `0.x.x`。この期間中は破壊的変更を MINOR で行ってよい（semver の慣例）。  
`1.0.0` への昇格は「外部ユーザーへ安定版として公開する」タイミングで行う。

---

## 2. 管理対象ファイルとディレクトリ

| 対象 | 場所 | 役割 |
|---|---|---|
| `package.json` → `"version"` | リポジトリ内 | アプリのバージョン（Electron が `app.getVersion()` で参照） |
| `CHANGELOG.md` | リポジトリ内 | 変更履歴（人間向け） |
| git タグ `v{version}` | ローカル / GitHub | コードベースのスナップショット（例: `v0.1.0`） |
| GitHub Releases | GitHub | dmg / zip の配布・アーカイブ（正式な配布元） |
| `release/` ディレクトリ | ローカルのみ（.gitignore済み） | ビルド中間出力。リリース後は削除して構わない |

`package.json` / `CHANGELOG.md` / git タグ / GitHub Release の4つを常に一致させることがルール。  
`release/` はビルド作業領域であり、配布物の保管場所ではない。

---

## 3. 日常の開発フロー

### 3-1. 機能開発中（リリース前）

`CHANGELOG.md` の `[Unreleased]` セクションに、変更をその都度追記する。

```markdown
## [Unreleased]

### Added
- 新機能の説明

### Fixed
- バグ修正の説明
```

コミット単位で細かく書かなくてよい。**ユーザーが読んで意味のある粒度**で書く。

### 3-2. カテゴリの使い分け

| カテゴリ | 内容 |
|---|---|
| `Added` | 新機能 |
| `Changed` | 既存機能の変更（後方互換あり） |
| `Deprecated` | 将来削除予定の機能 |
| `Removed` | 削除した機能 |
| `Fixed` | バグ修正 |
| `Security` | セキュリティ修正 |

---

## 4. リリース手順

以下を順番に実行する。

### Step 1: CHANGELOG.md を更新

`[Unreleased]` → バージョン番号と日付に変換し、新しい `[Unreleased]` セクションを追加する。

```markdown
## [Unreleased]

## [0.2.0] - 2026-XX-XX

### Added
- ...
```

末尾の diff リンクも更新する（後述）。

### Step 2: package.json のバージョンを更新

```bash
npm version minor   # MINOR を上げる場合
npm version patch   # PATCH を上げる場合
npm version major   # MAJOR を上げる場合
```

`npm version` は自動的に:
- `package.json` の `version` を書き換える
- `package-lock.json` を更新する
- `git commit` と `git tag` を作成する

> **注意**: `npm version` が作るコミットメッセージは英語のデフォルト（`v0.2.0`）になる。  
> これで問題なければそのまま使う。手動でやりたい場合は Step 2a を参照。

### Step 2a（手動の場合）

```bash
# package.json を手動で編集後:
git add package.json package-lock.json CHANGELOG.md
git commit -m "リリース v0.2.0"
git tag v0.2.0
```

### Step 3: ビルド・署名・パッケージ

```bash
npm run build
```

electron-builder が `release/` に dmg と zip を生成する。

### Step 4: 動作確認チェックリスト

- [ ] `package.json` の `version` が新バージョンになっている
- [ ] `CHANGELOG.md` に当該バージョンのセクションがある
- [ ] git タグ `vX.Y.Z` が打たれている（`git tag --list` で確認）
- [ ] `release/` の dmg を開いてアプリが起動することを確認
- [ ] タイトルバーまたは About にバージョンが正しく表示されている

### Step 5: GitHub にプッシュ

```bash
git push origin main
git push origin v0.2.0   # タグもプッシュ
```

### Step 6: GitHub Release を作成してパッケージをアップロード

```bash
# CHANGELOG.md から該当バージョンのノートをコピーして使う
gh release create v0.2.0 \
  "release/Gcode Tracer-0.2.0-arm64.dmg" \
  "release/Gcode Tracer-0.2.0-arm64-mac.zip" \
  --title "v0.2.0" \
  --notes-file /dev/stdin
```

または GitHub の Releases ページから手動でアップロードしても構わない。

### Step 7: ローカル release/ の後片付け（任意）

GitHub Release にアップロード済みなので、ローカルの `release/` は削除して構わない。

```bash
rm -rf release/
```

次回ビルド時に自動再生成される。

---

## 5. CHANGELOG.md の末尾リンクの書き方

```markdown
[Unreleased]: https://github.com/3ur3k4/gcode-tracer/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/3ur3k4/gcode-tracer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/3ur3k4/gcode-tracer/releases/tag/v0.1.0
```

リリースごとに1行追加し、`[Unreleased]` の比較元を最新タグに更新する。

---

## 6. ホットフィックス（緊急バグ修正）

1. 該当バージョンのタグからブランチを切る
   ```bash
   git checkout -b hotfix/0.1.1 v0.1.0
   ```
2. 修正をコミット
3. CHANGELOG.md に `[0.1.1]` セクションを追加
4. `npm version patch` でタグを打つ
5. `main` ブランチにもマージする（修正の取り込み）

---

## 7. 現在のバージョン履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| `0.1.0` | 2026-07-01 | 初回リリース（GRBL送信・Visualizer・GcodeTextPanel・ConsoleDrawer 等） |

---

## 8. よく使うコマンド

```bash
# タグ一覧
git tag --list

# 特定タグのコミット内容確認
git show v0.1.0

# タグを打つ（手動）
git tag v0.1.0

# タグをリモートに push
git push origin v0.1.0
git push origin --tags   # 全タグまとめて

# GitHub Release の一覧
gh release list

# GitHub Release の詳細（アップロード済みアセット確認）
gh release view v0.1.0

# GitHub Release を削除（間違えた場合）
gh release delete v0.1.0

# ローカルのビルド出力を削除
rm -rf release/
```
