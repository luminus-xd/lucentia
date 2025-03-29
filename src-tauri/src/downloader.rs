use std::path::PathBuf;
use youtube_dl::{downloader::download_yt_dlp, YoutubeDl};

/// yt-dlpバイナリのパスを取得する関数
/// アプリケーションのデータディレクトリにyt-dlpバイナリが存在するかチェックし、
/// 存在しない場合はダウンロードします。
pub async fn get_yt_dlp_path() -> Result<PathBuf, String> {
  // アプリケーションのデータディレクトリを取得
  let app_data_dir = dirs::data_dir()
    .ok_or_else(|| "アプリケーションデータディレクトリの取得に失敗しました".to_string())?
    .join("my-video-downloader");

  // ディレクトリが存在しない場合は作成
  if !app_data_dir.exists() {
    std::fs::create_dir_all(&app_data_dir)
      .map_err(|e| format!("ディレクトリの作成に失敗しました: {}", e))?;
  }

  // yt-dlpバイナリのパス
  let yt_dlp_path = app_data_dir.join(if cfg!(windows) {
    "yt-dlp.exe"
  } else {
    "yt-dlp"
  });

  // yt-dlpバイナリが存在するかチェック
  if !yt_dlp_path.exists() {
    println!("yt-dlpバイナリをダウンロードしています...");

    // yt-dlpバイナリをダウンロード
    match download_yt_dlp(&app_data_dir).await {
      Ok(path) => {
        println!("yt-dlpバイナリをダウンロードしました: {:?}", path);

        // Unixシステムでは実行権限を付与
        #[cfg(unix)]
        {
          use std::os::unix::fs::PermissionsExt;
          let metadata = std::fs::metadata(&path)
            .map_err(|e| format!("メタデータの取得に失敗しました: {}", e))?;
          let mut perms = metadata.permissions();
          perms.set_mode(0o755); // rwxr-xr-x
          std::fs::set_permissions(&path, perms)
            .map_err(|e| format!("権限の設定に失敗しました: {}", e))?;
        }

        Ok(path)
      }
      Err(e) => {
        eprintln!("yt-dlpのダウンロードエラー: {:?}", e);
        Err(format!("yt-dlpバイナリのダウンロードに失敗しました: {}", e))
      }
    }
  } else {
    println!("既存のyt-dlpバイナリを使用します: {:?}", yt_dlp_path);
    // バイナリのバージョンを確認
    let version_check = std::process::Command::new(&yt_dlp_path)
      .arg("--version")
      .output();

    match version_check {
      Ok(output) if output.status.success() => {
        let version = String::from_utf8_lossy(&output.stdout);
        println!("yt-dlpバージョン: {}", version.trim());
        Ok(yt_dlp_path)
      }
      _ => {
        println!("既存のyt-dlpバイナリのバージョン確認ができませんでした。正常に動作しない可能性があります。");
        println!("古いバイナリを削除して再ダウンロードを試みます");

        // 既存のバイナリを削除
        if let Err(e) = std::fs::remove_file(&yt_dlp_path) {
          eprintln!("古いyt-dlpバイナリの削除に失敗しました: {}", e);
        }

        // 再ダウンロードを試みる
        match download_yt_dlp(&app_data_dir).await {
          Ok(path) => {
            println!("yt-dlpバイナリを再ダウンロードしました: {:?}", path);

            // Unixシステムでは実行権限を付与
            #[cfg(unix)]
            {
              use std::os::unix::fs::PermissionsExt;
              if let Err(e) = std::fs::metadata(&path)
                .map_err(|e| format!("メタデータの取得に失敗しました: {}", e))
                .and_then(|metadata| {
                  let mut perms = metadata.permissions();
                  perms.set_mode(0o755); // rwxr-xr-x
                  std::fs::set_permissions(&path, perms)
                    .map_err(|e| format!("権限の設定に失敗しました: {}", e))
                })
              {
                eprintln!("権限設定エラー: {}", e);
              }
            }

            Ok(path)
          }
          Err(e) => {
            eprintln!("yt-dlpバイナリの再ダウンロードに失敗しました: {}", e);
            // それでも失敗した場合は元のパスを返す（最後の手段）
            eprintln!("元のバイナリパスを使用します（動作しない可能性があります）");
            Ok(yt_dlp_path)
          }
        }
      }
    }
  }
}
