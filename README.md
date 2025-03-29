# Lucentia

このアプリケーションは yt-dlp を利用して、YouTube などの動画をダウンロードすることが出来ます。

## 主な機能

- **動画ダウンロード**
  動画サイトのURLを指定して動画をダウンロード可能です。

- **音楽データダウンロード**
  音声データ（.mp3）のみをffmpegを使用して抽出し、ダウンロード可能です。

- **動画形式変換**
  ffmpegを使用して様々な形式に変換可能です。

- **自動出力ファイル名**
  出力ファイル名を省略した場合、動画のタイトルを取得してファイル名として使用します。
  任意のファイル名を指定することも可能です。ファイル名が重複する場合は自動的に一意の識別子が追加されます。

- **yt-dlp の自動ダウンロード**
  アプリケーション起動時に yt-dlp が自動的にダウンロードされるため、事前のインストールが不要です。

## 技術スタック

- **Tauri (Rust)**  
  バックエンド処理、システムのコマンド実行、イベント送信などに利用。

- **Next.js (React / TypeScript)**  
  フロントエンドのユーザーインターフェースを構築。

- **yt-dlp**  
  動画のダウンロードとフォーマット変換に使用。

- **ffmpeg**  
  音声抽出や動画形式変換の処理に使用。

## 📝 使用方法

### インストール方法

一般ユーザー向けのインストール手順です：

1. [リリースページ](https://github.com/yourusername/lucentia/releases)から最新バージョンをダウンロード
   - Windows: `.exe`または`.msi`ファイル
   - macOS: `.dmg`ファイル

2. ダウンロードしたファイルを実行してインストール
   - Windows: インストーラーの指示に従う
   - macOS: アプリケーションをApplicationsフォルダにドラッグ

### 使い方

1. アプリ起動後、動画の URL を入力します。  
   例: `https://www.youtube.com/watch?v=...`

2. 出力ファイル名を入力するか、空欄にすると動画タイトルが自動的に使用されます。  
   ダウンロード先はシステムのダウンロードフォルダに自動設定されます。

3. 必要に応じて、音声のみの抽出や品質設定、フォーマット選択などのオプションを設定します。

4. 「ダウンロード開始」ボタンをクリックすると、ダウンロードが開始され、進捗がリアルタイムに表示されます。

## 🚀 セットアップ

### 前提条件

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [ffmpeg](https://ffmpeg.org/download.html)
  音声抽出や動画形式変換に必要です。以下の方法でインストールできます：
  
  **Windows**: 
  - [公式サイト](https://ffmpeg.org/download.html)からダウンロードするか、
  - `winget install FFmpeg`（Windows Package Manager）
  - または`choco install ffmpeg`（Chocolatey）

  **macOS**:
  - `brew install ffmpeg`（Homebrew）

### 開発環境の準備

以下の手順は開発者向けです。アプリケーションの利用者は[リリースページ](https://github.com/yourusername/lucentia/releases)から直接ダウンロードしてください。

```bash
# プロジェクトの依存関係をインストール
npm install
```

## 🛠️ 開発

```bash
npm run dev:tauri
```

## 📦 ビルド

```bash
npm run build && npm run build:tauri
```

> **Note**
> これにより、各プラットフォーム向けのパッケージが生成されます。

## 🔄 CI/CD

> **Tip**
> このプロジェクトではGitHub Actionsを使用して自動化プロセスを実行しています。

- **テストビルド**: PRがmainブランチに対して作成されると実行
- **リリースビルド**: mainブランチへのプッシュまたはタグ（`v*`形式）プッシュ時に実行
- **手動トリガー**: workflow_dispatchイベントで手動実行も可能

詳細は`.github/workflows`ディレクトリを参照してください。

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。