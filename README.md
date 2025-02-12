# Video Downloader

Video Downloader は、Tauri と Next.js を利用して構築されたデスクトップアプリケーションです。
このアプリケーションは yt-dlp を利用して、YouTube などの動画をダウンロードします。
出力形式は MP4 で、ダウンロード進捗はリアルタイムに表示されます。

## 主な機能

- **動画ダウンロード**  
  YouTube や bilibili の URL を指定して動画をダウンロード可能です。

- **自動出力ファイル名**  
  出力ファイル名を省略した場合、動画のタイトルを取得してファイル名として使用します。

- **bilibili 対応**  
  bilibili の URL が入力された場合、自動的に "--cookies-from-browse firefox" オプションを付与してダウンロードを行います。

- **進捗表示**  
  ダウンロード進捗を HTML の `<progress>` 要素で表示し、リアルタイムに更新します。

- **ダウンロード中の UI 制御**  
  ダウンロード中は入力フォームおよびダウンロードボタンが無効化され、誤操作を防止します。

## 技術スタック

- **Tauri (Rust)**  
  バックエンド処理、システムのコマンド実行、イベント送信などに利用。

- **Next.js (App Router) (React / TypeScript)**  
  フロントエンドのユーザーインターフェースを構築。

- **yt-dlp**  
  動画のダウンロードとフォーマット変換に使用。

## インストール

### 前提条件

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/intro/)  
  ※ `npm install -g @tauri-apps/cli` でインストール
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)  
  ※ 公式リポジトリの手順に従ってインストール

### プロジェクトのクローンとセットアップ

1. リポジトリをクローン

```bash
git clone https://github.com/yourusername/your-repo-name.git
cd your-repo-name
```

2. Next.js の依存関係をインストール

```bash
npm install
```

※ Tauri の依存関係は Rust の cargo により管理されます。

## 開発環境での実行

1. Next.js の開発サーバーを起動
```bash
npm run dev
```

2. 別のターミナルで Tauri アプリを起動
```bash
npm run tauri dev
```

## ビルドとパッケージング

プロジェクトをビルドしてリリース版の実行可能ファイルを作成するには、以下を実行してください。

```bash
npm run build
npm run tauri build
```

これにより、各プラットフォーム向けのパッケージが生成されます。

## 使用方法

1. アプリ起動後、動画の URL を入力します。  
   例: `https://www.youtube.com/watch?v=...`

2. 出力ファイル名を入力するか、空欄にすると動画タイトルが自動的に使用されます。  
   ダウンロード先はシステムのダウンロードフォルダ（例: `/Users/username/Downloads`）に自動設定されます。

3. 「ダウンロード開始」ボタンをクリックすると、ダウンロードが開始され、進捗が画面上の `<progress>` 要素およびパーセンテージ表示でリアルタイムに更新されます。

## コントリビューション

ご意見、バグ報告、機能改善の提案などは大歓迎です。
プルリクエストや Issue を通じてご連絡ください。

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。