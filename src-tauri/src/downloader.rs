use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use serde::Serialize;
use tauri::Emitter;
use tokio::runtime::Runtime;
use youtube_dl::downloader::download_yt_dlp;

use crate::utils::ensure_app_data_dir;

// ─── パスキャッシュ ──────────────────────────────────

static YT_DLP_PATH_CACHE: OnceLock<PathBuf> = OnceLock::new();
static FFMPEG_DIR_CACHE: OnceLock<PathBuf> = OnceLock::new();
static DENO_PATH_CACHE: OnceLock<PathBuf> = OnceLock::new();
static SETUP_COMPLETE: AtomicBool = AtomicBool::new(false);

// ─── セットアップ進捗 ────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SetupProgress {
  step: String,
  status: String,
}

/// セットアップ完了状態を返す
pub fn is_setup_done() -> bool {
  SETUP_COMPLETE.load(Ordering::Relaxed)
}

/// セットアップステップを実行し、進捗をフロントに通知するヘルパー
async fn run_setup_step<F, T, Fut>(handle: &tauri::AppHandle, step: &str, label: &str, f: F)
where
  F: FnOnce() -> Fut,
  Fut: std::future::Future<Output = Result<T, String>>,
{
  let _ = handle.emit(
    "setup-progress",
    SetupProgress { step: step.into(), status: "in_progress".into() },
  );
  let result = f().await;
  let status = if result.is_ok() { "ready" } else { "error" };
  let _ = handle.emit(
    "setup-progress",
    SetupProgress { step: step.into(), status: status.into() },
  );
  match result {
    Ok(_) => log::info!("{label}の準備が完了しました"),
    Err(e) => log::error!("{label}の準備に失敗しました: {e}"),
  }
}

/// バックグラウンドで全バイナリを準備し、進捗をフロントに通知する
pub fn setup_binaries(app_handle: tauri::AppHandle) {
  std::thread::spawn(move || {
    let rt = Runtime::new().unwrap();
    rt.block_on(async {
      let handle = &app_handle;

      tokio::join!(
        run_setup_step(handle, "yt-dlp", "yt-dlpバイナリ", get_yt_dlp_path),
        run_setup_step(handle, "ffmpeg", "FFmpegバイナリ", ensure_ffmpeg),
        run_setup_step(handle, "deno", "Denoランタイム", ensure_deno),
      );

      SETUP_COMPLETE.store(true, Ordering::Relaxed);
      let _ = handle.emit("setup-complete", ());
      log::info!("全バイナリのセットアップが完了しました");
    });
  });
}

// ─── Windows コンソール非表示ヘルパー ─────────────────

/// Windows の CREATE_NO_WINDOW フラグ
#[cfg(windows)]
pub(crate) const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Windows でコンソールウィンドウを非表示にする `Command` を生成する
pub(crate) fn silent_command(program: &std::path::Path) -> std::process::Command {
  #[allow(unused_mut)]
  let mut cmd = std::process::Command::new(program);
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }
  cmd
}

// ─── yt-dlp ────────────────────────────────────────

/// yt-dlpバイナリのパスを取得する関数
/// 初回はバージョンチェックを行い、以降はキャッシュから返す
pub async fn get_yt_dlp_path() -> Result<PathBuf, String> {
  if let Some(cached) = YT_DLP_PATH_CACHE.get() {
    return Ok(cached.clone());
  }

  let path = get_yt_dlp_path_uncached().await?;
  let _ = YT_DLP_PATH_CACHE.set(path.clone());
  Ok(path)
}

/// yt-dlpバイナリのパスを取得する（キャッシュなし）
async fn get_yt_dlp_path_uncached() -> Result<PathBuf, String> {
  let app_data_dir = ensure_app_data_dir()?;

  let yt_dlp_path = app_data_dir.join(if cfg!(windows) {
    "yt-dlp.exe"
  } else {
    "yt-dlp"
  });

  if !yt_dlp_path.exists() {
    log::info!("yt-dlpバイナリをダウンロードしています...");
    return download_and_setup_yt_dlp(&app_data_dir).await;
  }

  log::info!("既存のyt-dlpバイナリを使用します: {}", yt_dlp_path.display());

  let version_check = silent_command(&yt_dlp_path)
    .arg("--version")
    .output();

  match version_check {
    Ok(output) if output.status.success() => {
      let version = String::from_utf8_lossy(&output.stdout);
      log::info!("yt-dlpバージョン: {}", version.trim());
      Ok(yt_dlp_path)
    }
    _ => {
      log::warn!("既存のyt-dlpバイナリのバージョン確認ができませんでした。再ダウンロードを試みます");

      if let Err(e) = std::fs::remove_file(&yt_dlp_path) {
        log::error!("古いyt-dlpバイナリの削除に失敗しました: {e}");
      }

      match download_and_setup_yt_dlp(&app_data_dir).await {
        Ok(path) => Ok(path),
        Err(e) => {
          log::error!("yt-dlpバイナリの再ダウンロードに失敗しました: {e}");
          log::warn!("元のバイナリパスを使用します（動作しない可能性があります）");
          Ok(yt_dlp_path)
        }
      }
    }
  }
}

/// yt-dlpを最新版に更新する（既存バイナリを削除して再ダウンロード）
pub async fn update_yt_dlp() -> Result<String, String> {
  let app_data_dir = ensure_app_data_dir()?;

  let yt_dlp_path = app_data_dir.join(if cfg!(windows) {
    "yt-dlp.exe"
  } else {
    "yt-dlp"
  });

  if yt_dlp_path.exists() {
    std::fs::remove_file(&yt_dlp_path)
      .map_err(|e| format!("error.ytdlp_delete_failed:{e}"))?;
    log::info!("古いyt-dlpバイナリを削除しました");
  }

  let path = download_and_setup_yt_dlp(&app_data_dir).await?;

  let version = silent_command(&path)
    .arg("--version")
    .output()
    .ok()
    .filter(|o| o.status.success())
    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    .unwrap_or_else(|| "unknown".to_string());

  log::info!("yt-dlpを更新しました: {version}");
  Ok(version)
}

/// yt-dlpのバージョンを取得する
pub async fn get_yt_dlp_version() -> Result<String, String> {
  let path = get_yt_dlp_path().await?;

  let output = silent_command(&path)
    .arg("--version")
    .output()
    .map_err(|e| format!("error.ytdlp_version_failed:{e}"))?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
  } else {
    Err("error.ytdlp_version_not_found".to_string())
  }
}

/// yt-dlpをダウンロードし、Unix環境では実行権限を付与する
async fn download_and_setup_yt_dlp(app_data_dir: &std::path::Path) -> Result<PathBuf, String> {
  let path = download_yt_dlp(app_data_dir)
    .await
    .map_err(|e| format!("error.ytdlp_download_failed:{e}"))?;

  log::info!("yt-dlpバイナリをダウンロードしました: {}", path.display());

  #[cfg(unix)]
  set_executable(&path)?;

  Ok(path)
}

// ─── FFmpeg ───────────────────────────────────────

/// FFmpegバイナリが格納されるディレクトリパスを取得する
pub fn get_ffmpeg_dir() -> Result<PathBuf, String> {
  let app_data_dir = ensure_app_data_dir()?;
  let ffmpeg_dir = app_data_dir.join("ffmpeg");
  std::fs::create_dir_all(&ffmpeg_dir)
    .map_err(|e| format!("error.dir_create_failed:{e}"))?;
  Ok(ffmpeg_dir)
}

/// FFmpegバイナリの準備（存在しなければダウンロード）
/// 初回はバージョンチェックを行い、以降はキャッシュから返す
pub async fn ensure_ffmpeg() -> Result<PathBuf, String> {
  if let Some(cached) = FFMPEG_DIR_CACHE.get() {
    return Ok(cached.clone());
  }

  let result = ensure_ffmpeg_uncached().await?;
  let _ = FFMPEG_DIR_CACHE.set(result.clone());
  Ok(result)
}

/// FFmpegバイナリの準備（キャッシュなし）
async fn ensure_ffmpeg_uncached() -> Result<PathBuf, String> {
  let ffmpeg_dir = get_ffmpeg_dir()?;
  let ffmpeg_path = ffmpeg_dir.join(ffmpeg_binary_name());
  let ffprobe_path = ffmpeg_dir.join(ffprobe_binary_name());

  if ffmpeg_path.exists() && ffprobe_path.exists() {
    match silent_command(&ffmpeg_path).arg("-version").output() {
      Ok(output) if output.status.success() => {
        let version = String::from_utf8_lossy(&output.stdout);
        let first_line = version.lines().next().unwrap_or("unknown");
        log::info!("既存のFFmpegを使用: {first_line}");
        return Ok(ffmpeg_dir);
      }
      _ => {
        log::warn!("既存のFFmpegバイナリが壊れています。再ダウンロードします");
        let _ = std::fs::remove_file(&ffmpeg_path);
        let _ = std::fs::remove_file(&ffprobe_path);
      }
    }
  }

  log::info!("FFmpegをダウンロードしています...");
  download_ffmpeg_binaries(&ffmpeg_dir).await?;
  Ok(ffmpeg_dir)
}

fn ffmpeg_binary_name() -> &'static str {
  if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" }
}

fn ffprobe_binary_name() -> &'static str {
  if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" }
}

/// プラットフォームに応じたFFmpegダウンロードURLのサフィックスを返す
fn ffmpeg_platform_suffix() -> Result<&'static str, String> {
  if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
    Ok("darwin-arm64")
  } else if cfg!(target_os = "macos") && cfg!(target_arch = "x86_64") {
    Ok("darwin-x64")
  } else if cfg!(target_os = "windows") && cfg!(target_arch = "x86_64") {
    Ok("win32-x64")
  } else if cfg!(target_os = "linux") && cfg!(target_arch = "x86_64") {
    Ok("linux-x64")
  } else if cfg!(target_os = "linux") && cfg!(target_arch = "aarch64") {
    Ok("linux-arm64")
  } else {
    Err("error.ffmpeg_not_supported".to_string())
  }
}

/// eugeneware/ffmpeg-static からFFmpegとFFprobeをダウンロードして展開する
async fn download_ffmpeg_binaries(dest_dir: &std::path::Path) -> Result<(), String> {
  let suffix = ffmpeg_platform_suffix()?;
  let base_url = "https://github.com/eugeneware/ffmpeg-static/releases/latest/download";

  let ffmpeg_url = format!("{base_url}/ffmpeg-{suffix}.gz");
  let ffprobe_url = format!("{base_url}/ffprobe-{suffix}.gz");

  let ffmpeg_path = dest_dir.join(ffmpeg_binary_name());
  let ffprobe_path = dest_dir.join(ffprobe_binary_name());

  let (ffmpeg_result, ffprobe_result) = tokio::join!(
    download_and_decompress_gz(&ffmpeg_url, &ffmpeg_path),
    download_and_decompress_gz(&ffprobe_url, &ffprobe_path),
  );

  ffmpeg_result?;
  ffprobe_result?;

  log::info!("FFmpegとFFprobeをインストールしました: {}", dest_dir.display());
  Ok(())
}

/// .gz ファイルをダウンロードしてストリーミング展開する
///
/// 一時ファイルに書き出してからリネームすることで、
/// 途中失敗時に不完全なバイナリが残ることを防ぐ。
async fn download_and_decompress_gz(
  url: &str,
  dest_path: &std::path::Path,
) -> Result<(), String> {
  use flate2::write::GzDecoder;
  use futures_util::StreamExt;
  use std::io::Write;

  log::info!("ダウンロード中: {url}");
  let response = reqwest::get(url)
    .await
    .map_err(|e| format!("error.ffmpeg_download_failed:{e}"))?;

  if !response.status().is_success() {
    return Err(format!("error.ffmpeg_download_http_failed:HTTP {}", response.status()));
  }

  let tmp_path = dest_path.with_extension("tmp");
  let file = std::fs::File::create(&tmp_path)
    .map_err(|e| format!("error.ffmpeg_file_create_failed:{e}"))?;
  let mut decoder = GzDecoder::new(file);

  let mut stream = response.bytes_stream();
  while let Some(chunk) = stream.next().await {
    let chunk = chunk.map_err(|e| format!("error.ffmpeg_response_failed:{e}"))?;
    decoder
      .write_all(&chunk)
      .map_err(|e| format!("error.ffmpeg_decompress_failed:{e}"))?;
  }

  decoder
    .finish()
    .map_err(|e| format!("error.ffmpeg_decompress_failed:{e}"))?;

  std::fs::rename(&tmp_path, dest_path)
    .map_err(|e| format!("error.ffmpeg_file_write_failed:{e}"))?;

  #[cfg(unix)]
  set_executable(dest_path)?;

  Ok(())
}

// ─── Deno (JSランタイム) ───────────────────────────

/// Denoバイナリが格納されるディレクトリパスを取得する
pub fn get_deno_dir() -> Result<PathBuf, String> {
  let app_data_dir = ensure_app_data_dir()?;
  let deno_dir = app_data_dir.join("deno");
  std::fs::create_dir_all(&deno_dir)
    .map_err(|e| format!("error.dir_create_failed:{e}"))?;
  Ok(deno_dir)
}

/// Denoバイナリの準備（存在しなければダウンロード）
/// 初回はバージョンチェックを行い、以降はキャッシュから返す
pub async fn ensure_deno() -> Result<PathBuf, String> {
  if let Some(cached) = DENO_PATH_CACHE.get() {
    return Ok(cached.clone());
  }

  let result = ensure_deno_uncached().await?;
  let _ = DENO_PATH_CACHE.set(result.clone());
  Ok(result)
}

/// Denoバイナリの準備（キャッシュなし）
async fn ensure_deno_uncached() -> Result<PathBuf, String> {
  let deno_dir = get_deno_dir()?;
  let deno_path = deno_dir.join(deno_binary_name());

  if deno_path.exists() {
    match silent_command(&deno_path).arg("--version").output() {
      Ok(output) if output.status.success() => {
        let version = String::from_utf8_lossy(&output.stdout);
        let first_line = version.lines().next().unwrap_or("unknown");
        log::info!("既存のDenoを使用: {first_line}");
        return Ok(deno_path);
      }
      _ => {
        log::warn!("既存のDenoバイナリが壊れています。再ダウンロードします");
        let _ = std::fs::remove_file(&deno_path);
      }
    }
  }

  log::info!("Denoをダウンロードしています...");
  download_deno(&deno_dir).await
}

/// プラットフォームに応じたDenoバイナリ名
fn deno_binary_name() -> &'static str {
  if cfg!(windows) { "deno.exe" } else { "deno" }
}

/// プラットフォームに応じたDenoダウンロードURL
fn deno_download_url() -> Result<String, String> {
  let target = if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
    "deno-aarch64-apple-darwin.zip"
  } else if cfg!(target_os = "macos") && cfg!(target_arch = "x86_64") {
    "deno-x86_64-apple-darwin.zip"
  } else if cfg!(target_os = "windows") && cfg!(target_arch = "x86_64") {
    "deno-x86_64-pc-windows-msvc.zip"
  } else if cfg!(target_os = "linux") && cfg!(target_arch = "x86_64") {
    "deno-x86_64-unknown-linux-gnu.zip"
  } else if cfg!(target_os = "linux") && cfg!(target_arch = "aarch64") {
    "deno-aarch64-unknown-linux-gnu.zip"
  } else {
    return Err("error.deno_not_supported".to_string());
  };

  Ok(format!(
    "https://github.com/denoland/deno/releases/latest/download/{target}"
  ))
}

/// DenoをGitHub Releasesからダウンロードして展開する
async fn download_deno(dest_dir: &std::path::Path) -> Result<PathBuf, String> {
  let url = deno_download_url()?;
  log::info!("Denoダウンロード元: {url}");

  let response = reqwest::get(&url)
    .await
    .map_err(|e| format!("error.deno_download_failed:{e}"))?;

  if !response.status().is_success() {
    return Err(format!("error.deno_download_http_failed:HTTP {}", response.status()));
  }

  let bytes = response
    .bytes()
    .await
    .map_err(|e| format!("error.deno_response_failed:{e}"))?;

  let cursor = std::io::Cursor::new(bytes);
  let mut archive = zip::ZipArchive::new(cursor)
    .map_err(|e| format!("error.deno_zip_failed:{e}"))?;

  let binary_name = deno_binary_name();
  let deno_path = dest_dir.join(binary_name);

  // ZIP内からDenoバイナリを探して展開
  for i in 0..archive.len() {
    let mut file = archive
      .by_index(i)
      .map_err(|e| format!("error.deno_zip_entry_failed:{e}"))?;

    if file.name().ends_with(binary_name) {
      let mut out = std::fs::File::create(&deno_path)
        .map_err(|e| format!("error.deno_file_create_failed:{e}"))?;
      std::io::copy(&mut file, &mut out)
        .map_err(|e| format!("error.deno_file_write_failed:{e}"))?;

      #[cfg(unix)]
      set_executable(&deno_path)?;

      log::info!("Denoをインストールしました: {}", deno_path.display());
      return Ok(deno_path);
    }
  }

  Err("error.deno_not_found_in_zip".to_string())
}

// ─── ユーティリティ ────────────────────────────────

/// Unix環境でファイルに実行権限を付与する
#[cfg(unix)]
fn set_executable(path: &std::path::Path) -> Result<(), String> {
  use std::os::unix::fs::PermissionsExt;
  let metadata = std::fs::metadata(path)
    .map_err(|e| format!("error.permission_failed:{e}"))?;
  let mut perms = metadata.permissions();
  perms.set_mode(0o755);
  std::fs::set_permissions(path, perms)
    .map_err(|e| format!("error.permission_failed:{e}"))?;
  Ok(())
}
