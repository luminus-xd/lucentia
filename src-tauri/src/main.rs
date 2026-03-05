// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use tokio::runtime::Runtime;

mod commands;
mod downloader;
mod history;
mod settings;
mod utils;

use crate::commands::{
  clear_history, download_metadata, download_video, get_download_stats, get_history,
  change_save_path, get_settings, get_yt_dlp_version, initialize_app, is_initialized,
  save_settings, update_yt_dlp, validate_save_path,
};
use crate::downloader::{ensure_deno, get_deno_dir, get_yt_dlp_path};

fn main() {
  // 環境に応じたPATH設定
  // Tauri アプリはシェルプロファイルを読まないため、
  // Homebrew, Volta, nvm, fnm 等の一般的なパスを明示的に追加する
  #[cfg(not(windows))]
  {
    let current_path = env::var("PATH").unwrap_or_default();
    let home = env::var("HOME").unwrap_or_default();

    // Volta の shim が動作するには VOLTA_HOME が必要
    let volta_home = format!("{home}/.volta");
    if std::path::Path::new(&volta_home).exists() && env::var("VOLTA_HOME").is_err() {
      env::set_var("VOLTA_HOME", &volta_home);
    }

    // アプリ同梱のDenoディレクトリを最優先でPATHに追加
    let deno_dir = get_deno_dir().unwrap_or_default();
    let deno_dir_str = deno_dir.to_string_lossy().to_string();

    let extra_paths = [
      deno_dir_str.as_str(),
      "/opt/homebrew/bin",
      "/usr/local/bin",
      &format!("{home}/.volta/bin"),
      &format!("{home}/.nvm/current/bin"),
      &format!("{home}/.fnm/current/bin"),
      &format!("{home}/.local/bin"),
    ];
    let new_path = format!("{}:{current_path}", extra_paths.join(":"));
    env::set_var("PATH", new_path);
  }

  #[cfg(windows)]
  {
    if let Ok(current_path) = env::var("PATH") {
      println!("現在のPATH: {}", current_path);
    }

    env::set_var("NO_COLOR", "1");
    env::set_var("HTTP_PROXY", "");
    env::set_var("HTTPS_PROXY", "");

    let temp_dirs = vec![
      dirs::home_dir().map(|p| p.join("Downloads")),
      dirs::data_dir().map(|p| p.join("my-video-downloader").join("temp")),
      Some(std::env::temp_dir().join("my-video-downloader")),
    ];

    for dir in temp_dirs.iter().flatten() {
      if !dir.exists() {
        if let Err(e) = std::fs::create_dir_all(dir) {
          eprintln!("一時ディレクトリの作成に失敗: {:?} - {}", dir, e);
        } else {
          println!("一時ディレクトリを作成: {:?}", dir);
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
    .invoke_handler(tauri::generate_handler![
      download_video,
      download_metadata,
      is_initialized,
      initialize_app,
      validate_save_path,
      change_save_path,
      get_settings,
      save_settings,
      get_history,
      get_download_stats,
      clear_history,
      update_yt_dlp,
      get_yt_dlp_version,
    ])
    .setup(|_app| {
      // yt-dlp と Deno のダウンロードを非同期で並行実行
      std::thread::spawn(|| {
        let rt = Runtime::new().unwrap();
        rt.block_on(async {
          let (yt_dlp_result, deno_result) =
            tokio::join!(get_yt_dlp_path(), ensure_deno());

          match yt_dlp_result {
            Ok(_) => log::info!("yt-dlpバイナリの準備が完了しました"),
            Err(e) => log::error!("yt-dlpバイナリの準備に失敗しました: {e}"),
          }
          match deno_result {
            Ok(_) => log::info!("Denoランタイムの準備が完了しました"),
            Err(e) => log::error!("Denoランタイムの準備に失敗しました: {e}"),
          }
        });
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
