// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use tokio::runtime::Runtime;

mod commands;
mod downloader;
mod utils;

use crate::commands::{download_metadata, download_video};
use crate::downloader::get_yt_dlp_path;

fn main() {
  // 環境に応じたPATH設定
  #[cfg(not(windows))]
  {
    // macOS/Linux環境のPATH設定
    let brew_paths = "/usr/local/bin:/opt/homebrew/bin";
    let current_path = env::var("PATH").unwrap_or_default();
    let new_path = format!("{}:{}", brew_paths, current_path);
    env::set_var("PATH", new_path);
  }

  #[cfg(windows)]
  {
    // Windows環境のPATH設定
    if let Ok(current_path) = env::var("PATH") {
      println!("現在のPATH: {}", current_path);
    }

    // Windows環境でのyt-dlp動作改善のための環境変数
    env::set_var("NO_COLOR", "1"); // カラー出力を無効化（Windows端末での問題回避）
                                   // プロキシ設定を無効化
    env::set_var("HTTP_PROXY", "");
    env::set_var("HTTPS_PROXY", "");

    // 一時ディレクトリの作成（複数の場所を試す）
    let temp_dirs = vec![
      dirs::home_dir().map(|p| p.join("Downloads")),
      dirs::data_dir().map(|p| p.join("my-video-downloader").join("temp")),
      std::env::temp_dir().join("my-video-downloader"),
    ];

    for dir in temp_dirs.iter().flatten() {
      if !dir.exists() {
        if let Err(e) = std::fs::create_dir_all(dir) {
          println!("一時ディレクトリの作成に失敗: {:?} - {}", dir, e);
        } else {
          println!("一時ディレクトリを作成: {:?}", dir);
          // 作成できたディレクトリを一時ディレクトリとして設定
          env::set_var("TEMP", dir.to_string_lossy().to_string());
          break;
        }
      } else {
        println!("既存の一時ディレクトリを使用: {:?}", dir);
        env::set_var("TEMP", dir.to_string_lossy().to_string());
        break;
      }
    }
  }

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![download_video, download_metadata])
    .setup(|_app| {
      // yt-dlpバイナリのダウンロードを非同期で実行
      // setupはsyncなので、新しいスレッドで実行
      std::thread::spawn(|| {
        let rt = Runtime::new().unwrap();
        rt.block_on(async {
          match get_yt_dlp_path().await {
            Ok(_) => println!("yt-dlpバイナリの準備が完了しました"),
            Err(e) => eprintln!("yt-dlpバイナリの準備に失敗しました: {}", e),
          }
        });
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
