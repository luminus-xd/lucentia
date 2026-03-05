# Lucentia

yt-dlp を利用した動画・音声ダウンロードデスクトップアプリ。

## 機能

- 動画サイトの URL から動画・音声をダウンロード
- MP3 / M4A 音声抽出
- 品質・フォーマット選択
- ダウンロード履歴の管理
- 日本語 / 英語対応

## インストール

[リリースページ](https://github.com/luminus-xd/my-video-downloader/releases)から最新バージョンをダウンロードしてください。

| OS | ファイル |
|----|---------|
| Windows | `.exe` / `.msi` |
| macOS | `.dmg` |

> yt-dlp と ffmpeg はアプリ初回起動時に自動ダウンロードされるため、個別のインストールは不要です。

## 技術スタック

- [Tauri 2](https://tauri.app/) (Rust)
- [Next.js](https://nextjs.org/) (React / TypeScript)

## 開発

```bash
npm install
npm run dev:tauri
```

## ビルド

```bash
npm run build && npm run build:tauri
```

## ライセンス

[MIT](LICENSE)
