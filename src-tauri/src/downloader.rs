use std::path::PathBuf;
use youtube_dl::downloader::download_yt_dlp;

/// yt-dlpバイナリのパスを取得する関数
/// アプリケーションのデータディレクトリにyt-dlpバイナリが存在するかチェックし、
/// 存在しない場合はダウンロードします。
pub async fn get_yt_dlp_path() -> Result<PathBuf, String> {
  let app_data_dir = dirs::data_dir()
    .ok_or_else(|| "アプリケーションデータディレクトリの取得に失敗しました".to_string())?
    .join("my-video-downloader");

  if !app_data_dir.exists() {
    std::fs::create_dir_all(&app_data_dir)
      .map_err(|e| format!("ディレクトリの作成に失敗しました: {}", e))?;
  }

  let yt_dlp_path = app_data_dir.join(if cfg!(windows) {
    "yt-dlp.exe"
  } else {
    "yt-dlp"
  });

  if !yt_dlp_path.exists() {
    log::info!("yt-dlpバイナリをダウンロードしています...");
    return download_and_setup(&app_data_dir).await;
  }

  log::info!("既存のyt-dlpバイナリを使用します: {:?}", yt_dlp_path);

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
        log::error!("古いyt-dlpバイナリの削除に失敗しました: {}", e);
      }

      match download_and_setup(&app_data_dir).await {
        Ok(path) => Ok(path),
        Err(e) => {
          log::error!("yt-dlpバイナリの再ダウンロードに失敗しました: {}", e);
          log::warn!("元のバイナリパスを使用します（動作しない可能性があります）");
          Ok(yt_dlp_path)
        }
      }
    }
  }
}

/// yt-dlpをダウンロードし、Unix環境では実行権限を付与する
async fn download_and_setup(app_data_dir: &std::path::Path) -> Result<PathBuf, String> {
  let path = download_yt_dlp(app_data_dir)
    .await
    .map_err(|e| format!("yt-dlpバイナリのダウンロードに失敗しました: {}", e))?;

  log::info!("yt-dlpバイナリをダウンロードしました: {:?}", path);

  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    let metadata = std::fs::metadata(&path)
      .map_err(|e| format!("メタデータの取得に失敗しました: {}", e))?;
    let mut perms = metadata.permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(&path, perms)
      .map_err(|e| format!("権限の設定に失敗しました: {}", e))?;
  }

  Ok(path)
}
