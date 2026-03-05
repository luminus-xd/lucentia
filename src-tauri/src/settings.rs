use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::utils::{ensure_app_data_dir, get_download_dir};

/// アプリケーション設定
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
  pub ffmpeg_path: String,
  pub hw_accel: bool,
  pub thread_count: u32,
  pub save_path: String,
  pub default_format: String,
  pub default_quality: String,
  pub concurrent_downloads: u32,
  pub notif_complete: bool,
  pub notif_error: bool,
  pub notif_sound: bool,
}

impl Default for AppSettings {
  fn default() -> Self {
    let default_save_path = get_download_dir()
      .map(|p| p.to_string_lossy().to_string())
      .unwrap_or_else(|_| "~/Downloads".to_string());

    Self {
      ffmpeg_path: detect_ffmpeg_path(),
      hw_accel: true,
      thread_count: 4,
      save_path: default_save_path,
      default_format: "mp4".to_string(),
      default_quality: "1080p".to_string(),
      concurrent_downloads: 3,
      notif_complete: true,
      notif_error: true,
      notif_sound: false,
    }
  }
}

/// 設定ファイルのパスを取得する
fn settings_path() -> Result<PathBuf, String> {
  Ok(ensure_app_data_dir()?.join("settings.json"))
}

/// ffmpegのパスを自動検出する
fn detect_ffmpeg_path() -> String {
  let candidates = if cfg!(windows) {
    vec!["ffmpeg.exe"]
  } else {
    vec![
      "/opt/homebrew/bin/ffmpeg",
      "/usr/local/bin/ffmpeg",
      "/usr/bin/ffmpeg",
    ]
  };

  for path in candidates {
    if std::path::Path::new(path).exists() {
      return path.to_string();
    }
  }

  "ffmpeg".to_string()
}

/// 設定を読み込む
pub fn load_settings() -> Result<AppSettings, String> {
  let path = settings_path()?;

  if !path.exists() {
    let defaults = AppSettings::default();
    save_settings(&defaults)?;
    return Ok(defaults);
  }

  let content =
    fs::read_to_string(&path).map_err(|e| format!("設定ファイルの読み込みに失敗: {e}"))?;

  serde_json::from_str(&content).map_err(|e| {
    log::warn!("設定ファイルのパースに失敗: {e}、デフォルト値を使用します");
    format!("設定ファイルのパースに失敗: {e}")
  })
}

/// 設定を保存する
pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
  let path = settings_path()?;

  let content = serde_json::to_string_pretty(settings)
    .map_err(|e| format!("設定のシリアライズに失敗: {e}"))?;

  fs::write(&path, content).map_err(|e| format!("設定ファイルの書き込みに失敗: {e}"))?;

  log::info!("設定を保存しました: {}", path.display());
  Ok(())
}
