#![allow(clippy::missing_errors_doc, clippy::missing_panics_doc)]

pub mod commands;
pub mod downloader;
pub mod history;
pub mod settings;
pub mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  use crate::commands::{
    clear_history, download_metadata, download_video, get_download_stats, get_history,
    get_settings, get_yt_dlp_version, save_settings, update_yt_dlp,
  };

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      download_video,
      download_metadata,
      get_settings,
      save_settings,
      get_history,
      get_download_stats,
      clear_history,
      update_yt_dlp,
      get_yt_dlp_version,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
