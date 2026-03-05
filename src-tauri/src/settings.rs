use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::utils::{ensure_app_data_dir, get_download_dir};

/// サブディレクトリ名
pub const SUBDIR_VIDEOS: &str = "videos";
pub const SUBDIR_AUDIO: &str = "audio";

/// アプリケーション設定
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
  /// 初回セットアップ完了フラグ
  #[serde(default)]
  pub initialized: bool,
  pub save_path: String,
  pub default_format: String,
  pub default_quality: String,
  pub concurrent_downloads: u32,
  pub cookies_browser: Option<String>,
  pub notif_complete: bool,
  pub notif_error: bool,
  pub notif_sound: bool,
}

impl Default for AppSettings {
  fn default() -> Self {
    let default_save_path = get_download_dir()
      .map(|p| p.to_string_lossy().into_owned())
      .unwrap_or_else(|_| "~/Downloads".to_string());

    Self {
      initialized: false,
      save_path: default_save_path,
      default_format: "mp4".to_string(),
      default_quality: "1080p".to_string(),
      concurrent_downloads: 3,
      cookies_browser: None,
      notif_complete: true,
      notif_error: true,
      notif_sound: false,
    }
  }
}

/// 指定されたパスにアプリ用ディレクトリ構造を作成する
pub fn ensure_save_dir_structure(save_path: &str) -> Result<(), String> {
  let base = std::path::Path::new(save_path);

  let dirs = [
    base.to_path_buf(),
    base.join(SUBDIR_VIDEOS),
    base.join(SUBDIR_AUDIO),
  ];

  for dir in &dirs {
    fs::create_dir_all(dir)
      .map_err(|e| format!("ディレクトリの作成に失敗: {} - {e}", dir.display()))?;
  }

  Ok(())
}

/// 保存先パスを更新する共通処理
fn update_save_path(save_path: &str, set_initialized: bool) -> Result<SavePathStatus, String> {
  ensure_save_dir_structure(save_path)?;

  let mut settings = load_settings().unwrap_or_default();
  if set_initialized {
    settings.initialized = true;
  }
  settings.save_path = save_path.to_string();
  save_settings(&settings)?;

  Ok(validate_save_path(save_path))
}

/// 初回セットアップ: ディレクトリ構造を作成し、設定を保存する
pub fn initialize_app(save_path: &str) -> Result<(), String> {
  update_save_path(save_path, true)?;
  log::info!("アプリの初期化が完了しました: {save_path}");
  Ok(())
}

/// 保存先を変更する
pub fn change_save_path(new_path: &str) -> Result<SavePathStatus, String> {
  let status = update_save_path(new_path, false)?;
  log::info!("保存先を変更しました: {new_path}");
  Ok(status)
}

/// 保存先ディレクトリの状態を検証する
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePathStatus {
  pub valid: bool,
  pub has_videos_dir: bool,
  pub has_audio_dir: bool,
}

pub fn validate_save_path(path: &str) -> SavePathStatus {
  let base = std::path::Path::new(path);
  SavePathStatus {
    valid: base.is_dir(),
    has_videos_dir: base.join(SUBDIR_VIDEOS).is_dir(),
    has_audio_dir: base.join(SUBDIR_AUDIO).is_dir(),
  }
}

/// 設定ファイルのパスを取得する
fn settings_path() -> Result<PathBuf, String> {
  Ok(ensure_app_data_dir()?.join("settings.json"))
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
