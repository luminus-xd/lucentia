use std::path::PathBuf;
use youtube_dl::downloader::download_yt_dlp;

use crate::utils::ensure_app_data_dir;

// ─── yt-dlp ────────────────────────────────────────

/// yt-dlpバイナリのパスを取得する関数
/// アプリケーションのデータディレクトリにyt-dlpバイナリが存在するかチェックし、
/// 存在しない場合はダウンロードします。
pub async fn get_yt_dlp_path() -> Result<PathBuf, String> {
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

  let version_check = std::process::Command::new(&yt_dlp_path)
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

  let version = std::process::Command::new(&path)
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

  let output = std::process::Command::new(&path)
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
pub async fn ensure_deno() -> Result<PathBuf, String> {
  let deno_dir = get_deno_dir()?;
  let deno_path = deno_dir.join(deno_binary_name());

  if deno_path.exists() {
    match std::process::Command::new(&deno_path).arg("--version").output() {
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
