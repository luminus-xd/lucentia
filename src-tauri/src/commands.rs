use chrono::{DateTime, Utc};
use regex::Regex;
use serde::Serialize;

use std::collections::HashMap;
use std::path::Path;
use std::sync::LazyLock;
use tauri::Emitter;
use tokio::io::AsyncBufReadExt;
use uuid::Uuid;
use youtube_dl::YoutubeDl;

use crate::downloader::get_yt_dlp_path;
use crate::history::{self, HistoryEntry, HistoryGroup, HistoryStatus};
use crate::settings::{self, AppSettings};
use crate::utils::{get_default_download_path, is_safe_path, is_valid_url, sanitize_filename};

/// 対応する動画拡張子
const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mkv", "webm", "avi", "mov", "flv"];
/// 対応する音声拡張子
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "m4a", "opus", "ogg", "wav", "flac", "aac"];

static RE_AMP_TIMESTAMP: LazyLock<Regex> =
  LazyLock::new(|| Regex::new(r"&t=\d+\.?\d*").unwrap());
static RE_FIRST_TIMESTAMP: LazyLock<Regex> =
  LazyLock::new(|| Regex::new(r"\?t=\d+\.?\d*&").unwrap());
static RE_ONLY_TIMESTAMP: LazyLock<Regex> =
  LazyLock::new(|| Regex::new(r"\?t=\d+\.?\d*$").unwrap());
static RE_PROGRESS: LazyLock<Regex> = LazyLock::new(|| {
  Regex::new(r"\[download\]\s+(\d+\.?\d*)%(?:\s+of\s+~?\S+\s+at\s+(\S+)(?:\s+ETA\s+(\S+))?)?")
    .unwrap()
});

#[derive(Serialize)]
pub struct VideoMetadata {
  pub title: String,
  pub thumbnail: Option<String>,
  pub duration: Option<String>,
}

/// yt-dlp メタデータ出力からサムネイルURLを抽出する
fn extract_thumbnail(output: &youtube_dl::YoutubeDlOutput) -> Option<String> {
  if let Some(playlist) = output.clone().into_playlist() {
    playlist
      .thumbnails
      .and_then(|thumbs| thumbs.first().cloned())
      .and_then(|thumb| thumb.url)
  } else if let Some(video) = output.clone().into_single_video() {
    video.thumbnail.or_else(|| {
      video
        .thumbnails
        .and_then(|thumbs| thumbs.first().cloned())
        .and_then(|thumb| thumb.url)
    })
  } else {
    None
  }
}

#[derive(Serialize, Clone)]
struct DownloadProgress {
  percent: f64,
  speed: Option<String>,
  eta: Option<String>,
}

#[tauri::command]
pub async fn download_metadata(url: String) -> Result<VideoMetadata, String> {
  log::info!("Downloading metadata: {url}");

  if !is_valid_url(&url) {
    return Err("error.invalid_url".to_string());
  }

  let cleaned_url = clean_timestamp_param(&url);
  let yt_dlp_path = get_yt_dlp_path().await?;
  let app_settings = settings::load_settings().unwrap_or_default();

  let mut instance = YoutubeDl::new(cleaned_url);
  instance.youtube_dl_path(&yt_dlp_path);

  instance
    .socket_timeout("15")
    .flat_playlist(true)
    .extra_arg("--no-check-certificate")
    .extra_arg("--force-ipv4");

  if let Some(browser) = &app_settings.cookies_browser {
    instance.extra_arg("--cookies-from-browser").extra_arg(browser);
  }

  let result = instance.run_async().await;

  log::info!("Downloaded metadata");

  match result {
    Ok(metadata) => {
      let thumbnail = extract_thumbnail(&metadata);

      if let Some(playlist) = metadata.clone().into_playlist() {
        Ok(VideoMetadata {
          title: playlist.title.unwrap_or_else(|| "No Title".to_string()),
          thumbnail,
          duration: None,
        })
      } else if let Some(video) = metadata.into_single_video() {
        let duration = video.duration.and_then(|d| format_duration(&d));

        Ok(VideoMetadata {
          title: video.title.unwrap_or_else(|| "No Title".to_string()),
          thumbnail,
          duration,
        })
      } else {
        Err("error.get_title_failed".to_string())
      }
    }
    Err(e) => Err(format!("error.metadata_failed:{e}")),
  }
}

/// `serde_json::Value` から duration を "MM:SS" 形式にフォーマットする
fn format_duration(d: &serde_json::Value) -> Option<String> {
  let seconds = if let Some(s) = d.as_u64() {
    Some(s)
  } else if let Some(f) = d.as_f64() {
    if f >= 0.0 && f.is_finite() {
      #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
      Some(f as u64)
    } else {
      None
    }
  } else if let Some(s) = d.as_str() {
    s.parse::<u64>().ok()
  } else {
    serde_json::to_string(d).ok().and_then(|json_str| {
      let cleaned = if json_str.contains('.') {
        json_str.split('.').next().unwrap_or("0").trim_matches('"')
      } else {
        json_str.trim_matches('"')
      };
      cleaned.parse::<u64>().ok()
    })
  };

  seconds.map(|s| format!("{:02}:{:02}", s / 60, s % 60))
}

#[tauri::command]
#[allow(clippy::too_many_arguments, clippy::too_many_lines)]
pub async fn download_video(
  app_handle: tauri::AppHandle,
  url: String,
  audio_only: bool,
  folder_path: Option<String>,
  best_quality: bool,
  download_subtitles: bool,
  preferred_format: Option<String>,
  custom_filename: Option<String>,
  thumbnail: Option<String>,
  metadata_title: Option<String>,
) -> Result<String, String> {
  log::info!("Downloading video: {url}");

  if !is_valid_url(&url) {
    return Err("error.invalid_url".to_string());
  }

  let cleaned_url = clean_timestamp_param(&url);
  let yt_dlp_path = get_yt_dlp_path().await?;

  // ファイル名の生成
  // 優先順: カスタムファイル名 > フロントエンドで取得済みのタイトル > yt-dlpから再取得
  let (filename_base, thumbnail) = match custom_filename {
    Some(filename) if !filename.trim().is_empty() => (sanitize_filename(&filename), thumbnail),
    _ => match metadata_title {
      Some(title) if !title.trim().is_empty() => (sanitize_filename(&title), thumbnail),
      _ => {
        let (title, fetched_thumb) = get_video_info(&cleaned_url, &yt_dlp_path.to_string_lossy()).await?;
        (title, thumbnail.or(fetched_thumb))
      }
    },
  };

  // 出力ファイル名生成（audio_only によって拡張子が変わる）
  let extension = if audio_only {
    "mp3"
  } else {
    preferred_format.as_deref().unwrap_or("mp4")
  };
  let output_filename = format!("{filename_base}.{extension}");

  // フォルダパスの検証と安全なパスの構築
  // 優先順位: 引数 folder_path > settings.save_path > OS デフォルト
  let app_settings = settings::load_settings().unwrap_or_default();

  let resolve_folder = |p: &str| -> Result<String, String> {
    let path = Path::new(p);
    if !path.is_dir() {
      return Err("error.path_not_dir".to_string());
    }
    // audio/video でサブディレクトリを振り分け
    let subdir = if audio_only { settings::SUBDIR_AUDIO } else { settings::SUBDIR_VIDEOS };
    let target_dir = path.join(subdir);
    let target_dir = if target_dir.is_dir() { target_dir } else { path.to_path_buf() };

    let full_path = target_dir.join(&output_filename);
    if !is_safe_path(&full_path) {
      return Err("error.unsafe_path".to_string());
    }
    Ok(full_path.to_string_lossy().to_string())
  };

  let base_output_path = match folder_path {
    Some(ref p) if !p.trim().is_empty() => resolve_folder(p)?,
    _ if !app_settings.save_path.is_empty() => {
      resolve_folder(&app_settings.save_path)
        .unwrap_or_else(|_| get_default_download_path(&output_filename).unwrap_or_default())
    }
    _ => get_default_download_path(&output_filename)?,
  };

  // ファイル名が存在する場合はUUIDを追加して重複を回避
  #[allow(unused_mut)]
  let mut output_path = if Path::new(&base_output_path).exists() {
    let dir = Path::new(&base_output_path)
      .parent()
      .ok_or("error.parent_dir_failed")?;
    let stem = Path::new(&output_filename)
      .file_stem()
      .ok_or("error.parent_dir_failed")?;
    let ext = Path::new(&output_filename)
      .extension()
      .ok_or("error.parent_dir_failed")?;

    let uuid_str = Uuid::new_v4().to_string();
    let uuid = uuid_str.split('-').next().unwrap_or("unique");
    let new_filename = format!(
      "{}_{}.{}",
      stem.to_string_lossy(),
      uuid,
      ext.to_string_lossy()
    );

    let new_path = dir.join(new_filename);
    log::info!("ファイル名の重複を回避: {}", new_path.to_string_lossy());

    new_path.to_string_lossy().to_string()
  } else {
    base_output_path
  };

  // Windows環境では単純なパス処理
  #[cfg(windows)]
  {
    let simple_path = if output_path.contains(" ") {
      let dir = Path::new(&output_path).parent().unwrap_or(Path::new(""));
      let ext = Path::new(&output_path)
        .extension()
        .unwrap_or_else(|| std::ffi::OsStr::new("mp4"));

      let filename_base = Path::new(&output_path)
        .file_stem()
        .unwrap_or_else(|| std::ffi::OsStr::new("video"))
        .to_string_lossy()
        .to_string();

      let clean_name = filename_base
        .chars()
        .filter(|c| !c.is_whitespace())
        .take(20)
        .collect::<String>();

      let new_path = dir.join(format!("{}.{}", clean_name, ext.to_string_lossy()));
      log::info!(
        "パス名を単純化: {} -> {}",
        output_path,
        new_path.to_string_lossy()
      );
      new_path.to_string_lossy().to_string()
    } else {
      output_path.clone()
    };

    output_path = simple_path;
  }

  log::info!("Output file: {output_path}");

  let args = build_yt_dlp_args(
    &cleaned_url,
    &output_path,
    audio_only,
    best_quality,
    download_subtitles,
    preferred_format.as_deref(),
    app_settings.cookies_browser.as_deref(),
  );

  log::info!("Starting download...");
  log::debug!(
    "実行コマンド: {} {}",
    yt_dlp_path.to_string_lossy(),
    args.join(" ")
  );

  if let Err(e) = run_yt_dlp_with_progress(&app_handle, &yt_dlp_path, &args, best_quality && !audio_only).await {
    let _ = history::add_entry(build_history_entry(
      &url, &filename_base, extension, best_quality,
      HistoryStatus::Failed, None, Some(e.clone()), thumbnail.clone(), None,
    ));
    return Err(e);
  }

  if Path::new(&output_path).exists() {
    let file_size = std::fs::metadata(&output_path).ok().map(|m| m.len());
    let size_str = file_size.map_or("不明".to_string(), |s| format!("{s} bytes"));
    log::info!("出力ファイル: {output_path} (サイズ: {size_str})");
    let _ = app_handle.emit("download-progress", DownloadProgress { percent: 100.0, speed: None, eta: None });

    let _ = history::add_entry(build_history_entry(
      &url, &filename_base, extension, best_quality,
      HistoryStatus::Success, file_size, None, thumbnail, Some(output_path.clone()),
    ));

    Ok(output_path)
  } else {
    log::warn!("出力ファイルが存在しません: {output_path}");

    let _ = history::add_entry(build_history_entry(
      &url, &filename_base, extension, best_quality,
      HistoryStatus::Failed, None, Some("error.file_not_found".to_string()), thumbnail, None,
    ));

    Err("error.file_not_found".to_string())
  }
}

/// yt-dlp のコマンド引数を構築する
fn build_yt_dlp_args(
  url: &str,
  output_path: &str,
  audio_only: bool,
  best_quality: bool,
  download_subtitles: bool,
  preferred_format: Option<&str>,
  cookies_browser: Option<&str>,
) -> Vec<String> {
  let format_value = preferred_format.unwrap_or("mp4");
  let mut args: Vec<String> = vec![
    "--newline".into(),
    "--socket-timeout".into(),
    "15".into(),
    "--no-check-certificate".into(),
  ];

  if let Some(browser) = cookies_browser {
    args.extend(["--cookies-from-browser".into(), browser.to_string()]);
  }

  #[cfg(windows)]
  args.push("--windows-filenames".into());

  if audio_only {
    args.extend(
      ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "0"]
        .map(String::from),
    );

    #[cfg(windows)]
    args.extend(
      ["--format", "best", "--no-mtime", "--no-part"]
        .map(String::from),
    );
  } else if best_quality {
    args.extend(
      [
        "--format",
        "bestvideo+bestaudio/best",
        "--merge-output-format",
        format_value,
      ]
      .map(String::from),
    );

    #[cfg(windows)]
    args.push("--prefer-ffmpeg".into());
  } else {
    args.extend(
      ["--format", "best", "--merge-output-format", format_value]
        .map(String::from),
    );

    #[cfg(windows)]
    args.push("--prefer-ffmpeg".into());
  }

  if download_subtitles {
    args.extend(
      [
        "--write-sub",
        "--write-auto-sub",
        "--sub-format",
        "srt",
        "--embed-subs",
        "--sub-lang",
        "ja,en",
      ]
      .map(String::from),
    );
  }

  args.extend(["-o".to_string(), output_path.to_string(), url.to_string()]);
  args
}

/// yt-dlp プロセスを起動し、進捗をフロントエンドにリアルタイム通知する
async fn run_yt_dlp_with_progress(
  app_handle: &tauri::AppHandle,
  yt_dlp_path: &Path,
  args: &[String],
  uses_separate_streams: bool,
) -> Result<(), String> {
  let mut child = tokio::process::Command::new(yt_dlp_path)
    .args(args)
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped())
    .spawn()
    .map_err(|e| format!("error.ytdlp_spawn:{e}"))?;

  let stdout = child
    .stdout
    .take()
    .ok_or("error.stdout_failed")?;
  let stderr = child
    .stderr
    .take()
    .ok_or("error.stderr_failed")?;

  // stderr をバックグラウンドで収集（エラー報告用）
  let stderr_handle = tokio::spawn(async move {
    let reader = tokio::io::BufReader::new(stderr);
    let mut lines = reader.lines();
    let mut output = String::new();
    while let Ok(Some(line)) = lines.next_line().await {
      log::debug!("yt-dlp stderr: {line}");
      output.push_str(&line);
      output.push('\n');
    }
    output
  });

  // stdout をパースしてダウンロード進捗を取得
  let reader = tokio::io::BufReader::new(stdout);
  let mut lines = reader.lines();
  let mut pass: u32 = 0;
  let mut last_raw_percent: f64 = 0.0;
  let mut last_emitted: f64 = 0.0;

  while let Ok(Some(line)) = lines.next_line().await {
    log::debug!("yt-dlp: {line}");

    if let Some(caps) = RE_PROGRESS.captures(&line) {
      if let Ok(raw_percent) = caps[1].parse::<f64>() {
        // パーセンテージが大幅に下がった場合、新しいダウンロードパスと判定
        if raw_percent < last_raw_percent - 10.0 {
          pass += 1;
        }
        last_raw_percent = raw_percent;

        let percent = if uses_separate_streams {
          match pass {
            0 => raw_percent * 0.5,          // 映像ストリーム: 0-50%
            1 => 50.0 + raw_percent * 0.45,  // 音声ストリーム: 50-95%
            _ => 95.0,
          }
        } else {
          raw_percent * 0.95 // 単一ストリーム: 0-95%
        };

        let percent = percent.min(95.0);

        // speed / ETA をキャプチャ（yt-dlp 出力に含まれている場合のみ）
        let speed = caps.get(2).map(|m| m.as_str().to_string());
        let eta = caps.get(3).map(|m| m.as_str().to_string());

        // 前回より大きい値のときだけ emit（プログレスバーの逆戻りを防止）
        if percent > last_emitted {
          last_emitted = percent;
          let _ = app_handle.emit("download-progress", DownloadProgress { percent, speed, eta });
        }
      }
    } else if (line.contains("[Merger]")
      || line.contains("[ExtractAudio]")
      || line.contains("[FixupM3u8]"))
      && last_emitted < 95.0
    {
      last_emitted = 95.0;
      let _ = app_handle.emit(
        "download-progress",
        DownloadProgress { percent: 95.0, speed: None, eta: None },
      );
    }
  }

  let status = child
    .wait()
    .await
    .map_err(|e| format!("error.process_failed:{e}"))?;

  let stderr_output = stderr_handle.await.unwrap_or_default();

  if !status.success() {
    log::error!("yt-dlpがエラーで終了しました: {stderr_output}");
    return Err(format!(
      "error.download_failed:{}",
      stderr_output.lines().last().unwrap_or("unknown error")
    ));
  }

  Ok(())
}

/// URLからタイムスタンプパラメータ(t=XX)を安全に削除する関数
fn clean_timestamp_param(url: &str) -> String {
  if !url.contains("t=") {
    return url.to_string();
  }

  let cleaned = RE_AMP_TIMESTAMP.replace_all(url, "").to_string();
  let cleaned = RE_FIRST_TIMESTAMP.replace_all(&cleaned, "?").to_string();
  let cleaned = RE_ONLY_TIMESTAMP.replace_all(&cleaned, "").to_string();

  if cleaned != url {
    log::info!("タイムスタンプを削除したURL: {cleaned}");
  }

  cleaned
}

/// ダウンロード履歴エントリを構築するヘルパー
fn build_history_entry(
  url: &str,
  title: &str,
  extension: &str,
  best_quality: bool,
  status: HistoryStatus,
  file_size: Option<u64>,
  error_message: Option<String>,
  thumbnail: Option<String>,
  file_path: Option<String>,
) -> HistoryEntry {
  let format_label = match status {
    HistoryStatus::Success if best_quality => {
      format!("{} best", extension.to_uppercase())
    }
    _ => extension.to_uppercase(),
  };

  HistoryEntry {
    id: Uuid::new_v4().to_string(),
    url: url.to_string(),
    title: title.to_string(),
    thumbnail,
    file_path,
    format: format_label,
    size: file_size,
    status,
    error_message,
    timestamp: Utc::now(),
  }
}

// ─── yt-dlp コマンド ──────────────────────────────

#[tauri::command]
pub async fn update_yt_dlp() -> Result<String, String> {
  crate::downloader::update_yt_dlp().await
}

#[tauri::command]
pub async fn get_yt_dlp_version() -> Result<String, String> {
  crate::downloader::get_yt_dlp_version().await
}

// ─── 初期化コマンド ────────────────────────────────

#[tauri::command]
pub fn is_initialized() -> Result<bool, String> {
  let s = settings::load_settings().unwrap_or_default();
  Ok(s.initialized)
}

#[tauri::command]
pub fn initialize_app(save_path: String) -> Result<(), String> {
  settings::initialize_app(&save_path)
}

#[tauri::command]
pub fn validate_save_path(path: String) -> settings::SavePathStatus {
  settings::validate_save_path(&path)
}

#[tauri::command]
pub fn change_save_path(new_path: String) -> Result<settings::SavePathStatus, String> {
  settings::change_save_path(&new_path)
}

// ─── 設定コマンド ─────────────────────────────────

#[tauri::command]
pub fn get_settings() -> Result<AppSettings, String> {
  settings::load_settings()
}

#[tauri::command]
pub fn save_settings(new_settings: AppSettings) -> Result<(), String> {
  settings::save_settings(&new_settings)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetSettingsResult {
  pub settings: AppSettings,
  pub path_status: settings::SavePathStatus,
}

#[tauri::command]
pub fn reset_settings() -> Result<ResetSettingsResult, String> {
  let mut defaults = AppSettings::default();
  defaults.initialized = true;
  settings::save_settings(&defaults)?;
  let path_status = settings::validate_save_path(&defaults.save_path);
  Ok(ResetSettingsResult {
    settings: defaults,
    path_status,
  })
}

#[tauri::command]
pub fn clear_cache() -> Result<(), String> {
  let app_data = crate::utils::ensure_app_data_dir()?;

  // yt-dlp のキャッシュディレクトリを削除
  let cache_dirs = ["cache", "__pycache__"];
  for name in &cache_dirs {
    let dir = app_data.join(name);
    match std::fs::remove_dir_all(&dir) {
      Ok(()) => log::info!("キャッシュを削除しました: {}", dir.display()),
      Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
      Err(e) => return Err(format!("error.cache_clear_failed:{e}")),
    }
  }

  Ok(())
}


// ─── 履歴コマンド ─────────────────────────────────

#[tauri::command]
pub fn get_history() -> Result<Vec<HistoryGroup>, String> {
  history::get_grouped_history()
}

#[tauri::command]
pub fn get_download_stats() -> Result<history::DownloadStats, String> {
  history::get_stats()
}

#[tauri::command]
pub fn clear_history() -> Result<(), String> {
  history::clear_all()
}

// ─── ファイル管理コマンド ──────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedFile {
  pub id: String,
  pub title: String,
  pub thumbnail: Option<String>,
  pub filename: String,
  pub path: String,
  pub format: String,
  pub size: u64,
  pub category: String,
  pub modified_at: String,
}

/// 保存ディレクトリ内のダウンロード済みファイル一覧を取得する
#[tauri::command]
pub fn list_downloaded_files() -> Result<Vec<DownloadedFile>, String> {
  let app_settings = settings::load_settings().unwrap_or_default();
  let save_path = &app_settings.save_path;

  if save_path.is_empty() {
    return Ok(Vec::new());
  }

  let base = Path::new(save_path);
  if !base.is_dir() {
    return Ok(Vec::new());
  }

  // 履歴からファイルパス→サムネイルURLのマップを構築
  let thumbnail_map: HashMap<String, String> = history::load_all_entries()
    .unwrap_or_default()
    .into_iter()
    .filter_map(|e| match (e.file_path, e.thumbnail) {
      (Some(path), Some(thumb)) => Some((path, thumb)),
      _ => None,
    })
    .collect();

  let mut files: Vec<DownloadedFile> = Vec::new();

  // videos/ と audio/ の両方をスキャン
  let scan_targets = [
    (base.join(settings::SUBDIR_VIDEOS), "video", VIDEO_EXTENSIONS),
    (base.join(settings::SUBDIR_AUDIO), "audio", AUDIO_EXTENSIONS),
  ];

  for (dir, category, extensions) in &scan_targets {
    if !dir.is_dir() {
      continue;
    }

    let entries = std::fs::read_dir(dir)
      .map_err(|e| format!("error.dir_read_failed:{e}"))?;

    for entry in entries.flatten() {
      let path = entry.path();

      // メタデータ取得（entry.metadata() で1回のシステムコールに統一）
      let metadata = match entry.metadata() {
        Ok(m) => m,
        Err(_) => continue,
      };

      // ディレクトリはスキップ
      if !metadata.is_file() {
        continue;
      }

      // 隠しファイルはスキップ
      let filename = match path.file_name().and_then(|n| n.to_str()) {
        Some(name) if !name.starts_with('.') => name.to_string(),
        _ => continue,
      };

      // 拡張子でフィルタ
      let ext_lower = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

      if !extensions.contains(&ext_lower.as_str()) {
        continue;
      }

      let size = metadata.len();
      let modified_at = metadata
        .modified()
        .ok()
        .map(|t| {
          let datetime: DateTime<Utc> = t.into();
          datetime.to_rfc3339()
        })
        .unwrap_or_default();

      let title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&filename)
        .to_string();

      let format = ext_lower.to_uppercase();
      let full_path = path.to_string_lossy().to_string();

      let thumbnail = thumbnail_map.get(&full_path).cloned();

      files.push(DownloadedFile {
        id: full_path.clone(),
        title,
        thumbnail,
        filename,
        path: full_path,
        format,
        size,
        category: (*category).to_string(),
        modified_at,
      });
    }
  }

  // 更新日時の降順でソート（新しいものが先頭）
  files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

  Ok(files)
}

/// 指定されたファイルを削除する
#[tauri::command]
pub fn delete_downloaded_files(ids: Vec<String>) -> Result<(), String> {
  let app_settings = settings::load_settings().unwrap_or_default();
  let save_path = &app_settings.save_path;

  if save_path.is_empty() {
    return Err("error.save_path_not_set".to_string());
  }

  let base = std::fs::canonicalize(save_path)
    .map_err(|e| format!("error.path_canon_failed:{e}"))?;

  for id in &ids {
    let file_path = Path::new(id);

    // パスが保存ディレクトリ内にあることを検証
    let canonical = std::fs::canonicalize(file_path)
      .map_err(|e| format!("error.path_canon_failed:{id} - {e}"))?;

    if !canonical.starts_with(&base) {
      return Err(format!(
        "error.unsafe_path_outside:{id}"
      ));
    }

    match std::fs::remove_file(file_path) {
      Ok(()) => log::info!("ファイルを削除しました: {id}"),
      Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
        log::warn!("削除対象のファイルが見つかりません: {id}");
      }
      Err(e) => return Err(format!("error.file_delete_failed:{id} - {e}")),
    }
  }

  Ok(())
}

/// ファイルをシステムのファイルマネージャで表示する
#[tauri::command]
pub fn open_file_in_folder(path: String) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .arg("-R")
      .arg(&path)
      .spawn()
      .map_err(|e| format!("error.finder_failed:{e}"))?;
  }

  #[cfg(target_os = "windows")]
  {
    std::process::Command::new("explorer")
      .arg(format!("/select,{path}"))
      .spawn()
      .map_err(|e| format!("error.explorer_failed:{e}"))?;
  }

  #[cfg(target_os = "linux")]
  {
    let file_path = Path::new(&path);
    let parent = file_path
      .parent()
      .ok_or("error.parent_dir_failed")?;
    std::process::Command::new("xdg-open")
      .arg(parent)
      .spawn()
      .map_err(|e| format!("error.file_manager_failed:{e}"))?;
  }

  Ok(())
}

/// ファイルをデフォルトのアプリケーションで開く
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .arg(&path)
      .spawn()
      .map_err(|e| format!("error.file_open_failed:{e}"))?;
  }

  #[cfg(target_os = "windows")]
  {
    std::process::Command::new("cmd")
      .args(["/C", "start", "", &path])
      .spawn()
      .map_err(|e| format!("error.file_open_failed:{e}"))?;
  }

  #[cfg(target_os = "linux")]
  {
    std::process::Command::new("xdg-open")
      .arg(&path)
      .spawn()
      .map_err(|e| format!("error.file_open_failed:{e}"))?;
  }

  Ok(())
}

/// タイトルとサムネイルを取得する補助関数
async fn get_video_info(url: &str, yt_dlp_path: &str) -> Result<(String, Option<String>), String> {
  let mut meta_instance = YoutubeDl::new(url.to_string());
  meta_instance.youtube_dl_path(yt_dlp_path);

  meta_instance
    .socket_timeout("15")
    .flat_playlist(true)
    .extra_arg("--no-check-certificate")
    .extra_arg("--force-ipv4");

  if let Ok(s) = settings::load_settings() {
    if let Some(browser) = &s.cookies_browser {
      meta_instance.extra_arg("--cookies-from-browser").extra_arg(browser);
    }
  }

  let metadata_result = meta_instance.run_async().await;

  match metadata_result {
    Ok(metadata) => {
      let thumbnail = extract_thumbnail(&metadata);

      if let Some(playlist) = metadata.clone().into_playlist() {
        Ok((
          sanitize_filename(&playlist.title.unwrap_or_else(|| "No Title".to_string())),
          thumbnail,
        ))
      } else if let Some(video) = metadata.into_single_video() {
        Ok((
          sanitize_filename(&video.title.unwrap_or_else(|| "No Title".to_string())),
          thumbnail,
        ))
      } else {
        Err("error.get_title_failed".to_string())
      }
    }
    Err(e) => {
      log::error!("メタデータ取得エラー: {e:?}");
      Err(format!("error.video_info_failed:{e}"))
    }
  }
}
