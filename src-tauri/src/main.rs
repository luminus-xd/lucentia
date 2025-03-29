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
  // 従来のPATH設定も残しておく（ダウンロードに失敗した場合のフォールバック用）
  let brew_paths = "/usr/local/bin:/opt/homebrew/bin";
  let current_path = env::var("PATH").unwrap_or_default();
  let new_path = format!("{}:{}", brew_paths, current_path);
  env::set_var("PATH", new_path);

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
