#!/bin/bash

# バージョン番号
VERSION="v1.0.0"

# 変更をコミット
git add src-tauri/tauri.conf.json
git commit -m "chore: バージョンを1.0.0に更新"

# タグを作成
git tag $VERSION

# タグをプッシュ（これによりGitHub Actionsが起動）
git push origin $VERSION

echo "タグ $VERSION をプッシュしました。GitHub Actionsがビルドとリリース作成を開始します。"
echo "リリースページ: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases"
echo ""
echo "注意: ビルドが完了すると、ドラフトリリースが作成されます。"
echo "GitHubのリリースページで以下のリリースノートを追加し、'Publish release'をクリックしてください。"
echo ""
echo "------------ リリースノート（コピーして使用） ------------"
cat << 'EOT'
# Lucentia v1.0.0

## 主な機能

- **動画ダウンロード**：YouTubeやbilibili動画をダウンロード可能
- **自動ファイル名生成**：動画タイトルを自動検出
- **ダウンロード進捗表示**：リアルタイムの進捗バー
- **yt-dlp自動ダウンロード**：内部で自動的にyt-dlpをセットアップ
- **bilibili対応**：自動的にブラウザからcookieを取得

## インストール方法

1. お使いのプラットフォームに合わせたインストーラーをダウンロード：
   - Windows: `.msi`ファイル
   - macOS: `.dmg`ファイル

2. インストーラーを実行してインストールを完了

## 既知の問題

- ダウンロード中に動画のサムネイルは表示されません
- 一部の動画サイトでは追加の設定が必要な場合があります

## フィードバック

問題や提案があれば、GitHubのIssueページからご報告ください。
EOT
echo "-------------------------------------------------------" 