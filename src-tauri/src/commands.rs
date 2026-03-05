use regex::Regex;
use serde::Serialize;
use serde_json;
use std::path::Path;
use std::sync::LazyLock;
use uuid::Uuid;
use youtube_dl::YoutubeDl;

use crate::downloader::get_yt_dlp_path;
use crate::utils::{get_default_download_path, is_safe_path, is_valid_url, sanitize_filename};

static RE_AMP_TIMESTAMP: LazyLock<Regex> =
  LazyLock::new(|| Regex::new(r"&t=\d+\.?\d*").unwrap());
static RE_FIRST_TIMESTAMP: LazyLock<Regex> =
  LazyLock::new(|| Regex::new(r"\?t=\d+\.?\d*&").unwrap());
static RE_ONLY_TIMESTAMP: LazyLock<Regex> =
  LazyLock::new(|| Regex::new(r"\?t=\d+\.?\d*$").unwrap());

#[derive(Serialize)]
pub struct VideoMetadata {
  pub title: String,
  pub thumbnail: Option<String>,
  pub duration: Option<String>,
}

#[derive(Serialize)]
pub struct VideoFormat {
  pub format_id: String,
  pub ext: String,
  pub resolution: String,
}

#[tauri::command]
pub async fn download_metadata(url: String) -> Result<VideoMetadata, String> {
  log::info!("Downloading metadata: {}", url);

  if !is_valid_url(&url) {
    return Err("有効なURLではありません".to_string());
  }

  let cleaned_url = clean_timestamp_param(&url);
  let yt_dlp_path = get_yt_dlp_path().await?;

  let mut instance = YoutubeDl::new(cleaned_url);
  instance.youtube_dl_path(&yt_dlp_path);

  let result = instance
    .socket_timeout("15")
    .flat_playlist(true)
    .extra_arg("--no-check-certificate")
    .extra_arg("--force-ipv4")
    .run_async()
    .await;

  log::info!("Downloaded metadata");

  match result {
    Ok(metadata) => {
      if let Some(playlist) = metadata.clone().into_playlist() {
        let thumbnail = playlist
          .thumbnails
          .and_then(|thumbs| thumbs.first().cloned())
          .and_then(|thumb| thumb.url);

        log::info!("プレイリストサムネイル: {:?}", thumbnail);

        Ok(VideoMetadata {
          title: playlist.title.unwrap_or_else(|| "No Title".to_string()),
          thumbnail,
          duration: None,
        })
      } else if let Some(video) = metadata.into_single_video() {
        let thumbnail = video.thumbnail.or_else(|| {
          video
            .thumbnails
            .and_then(|thumbs| thumbs.first().cloned())
            .and_then(|thumb| thumb.url)
        });

        log::info!("ビデオサムネイル: {:?}", thumbnail);

        let duration = video.duration.and_then(|d| format_duration(&d));

        log::info!("最終的なduration値: {:?}", duration);

        Ok(VideoMetadata {
          title: video.title.unwrap_or_else(|| "No Title".to_string()),
          thumbnail,
          duration,
        })
      } else {
        Err("Error getting title".to_string())
      }
    }
    Err(e) => Err(e.to_string()),
  }
}

/// serde_json::Value から duration を "MM:SS" 形式にフォーマットする
fn format_duration(d: &serde_json::Value) -> Option<String> {
  let seconds = if let Some(s) = d.as_u64() {
    Some(s)
  } else if let Some(f) = d.as_f64() {
    Some(f as u64)
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
pub async fn download_video(
  url: String,
  audio_only: bool,
  folder_path: Option<String>,
  best_quality: bool,
  download_subtitles: bool,
  preferred_format: Option<String>,
  custom_filename: Option<String>,
) -> Result<(), String> {
  log::info!("Downloading video: {}", url);

  if !is_valid_url(&url) {
    return Err("有効なURLではありません".to_string());
  }

  let cleaned_url = clean_timestamp_param(&url);
  let yt_dlp_path = get_yt_dlp_path().await?;

  // ファイル名の生成 (カスタムかタイトル自動取得)
  let filename_base = match custom_filename {
    Some(filename) if !filename.trim().is_empty() => sanitize_filename(&filename),
    _ => get_video_title(&cleaned_url, &yt_dlp_path.to_string_lossy()).await?,
  };

  // 出力ファイル名生成（audio_only によって拡張子が変わる）
  let extension = if audio_only {
    "mp3".to_string()
  } else {
    preferred_format
      .clone()
      .unwrap_or_else(|| "mp4".to_string())
  };
  let output_filename = format!("{}.{}", filename_base, extension);

  // フォルダパスの検証と安全なパスの構築
  let base_output_path = if let Some(p) = folder_path {
    if p.trim().is_empty() {
      get_default_download_path(&output_filename)?
    } else {
      let path = Path::new(&p);
      if !path.exists() || !path.is_dir() {
        return Err("指定されたパスが存在しないか、ディレクトリではありません".to_string());
      }

      let full_path = path.join(&output_filename);
      if !is_safe_path(&full_path) {
        return Err("安全でないパスが指定されました".to_string());
      }

      full_path.to_string_lossy().to_string()
    }
  } else {
    get_default_download_path(&output_filename)?
  };

  // ファイル名が存在する場合はUUIDを追加して重複を回避
  #[allow(unused_mut)]
  let mut output_path = if Path::new(&base_output_path).exists() {
    let dir = Path::new(&base_output_path)
      .parent()
      .ok_or("パスの親ディレクトリを取得できませんでした")?;
    let stem = Path::new(&output_filename)
      .file_stem()
      .ok_or("ファイル名からステム部分を取得できませんでした")?;
    let ext = Path::new(&output_filename)
      .extension()
      .ok_or("ファイル名から拡張子を取得できませんでした")?;

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

  log::info!("Output file: {}", output_path);

  let mut instance = YoutubeDl::new(cleaned_url);
  instance.youtube_dl_path(&yt_dlp_path);

  instance
    .socket_timeout("15")
    .extra_arg("--no-check-certificate")
    .extra_arg("--verbose");

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
    instance.extra_arg("--windows-filenames");
  }

  if audio_only {
    instance
      .extract_audio(true)
      .extra_arg("--audio-format")
      .extra_arg("mp3")
      .extra_arg("--audio-quality")
      .extra_arg("0");

    #[cfg(windows)]
    {
      instance
        .format("best")
        .extra_arg("--no-mtime")
        .extra_arg("--no-part")
        .extra_arg("--windows-filenames");
    }
  } else {
    let format = match &preferred_format {
      Some(fmt) => fmt.as_str(),
      None => "mp4",
    };

    #[cfg(not(windows))]
    {
      if best_quality {
        instance
          .format("bestvideo+bestaudio/best")
          .extra_arg("--merge-output-format")
          .extra_arg(format);
      } else {
        instance
          .format("best")
          .extra_arg("--merge-output-format")
          .extra_arg(format);
      }
    }

    #[cfg(windows)]
    {
      instance.format("best");
      instance.extra_arg("--prefer-ffmpeg");
    }
  }

  if download_subtitles {
    instance
      .extra_arg("--write-sub")
      .extra_arg("--write-auto-sub")
      .extra_arg("--sub-format")
      .extra_arg("srt")
      .extra_arg("--embed-subs")
      .extra_arg("--sub-lang")
      .extra_arg("ja,en");
  }

  instance.extra_arg("-o").extra_arg(&output_path);

  log::info!("Starting download...");
  log::debug!(
    "実行コマンド（参考）: {} --verbose \"{}\" -o \"{}\"",
    yt_dlp_path.to_string_lossy(),
    &url,
    output_path
  );

  // Windows環境では直接実行を試みる
  #[cfg(windows)]
  {
    log::info!("Windows環境では直接コマンド実行を優先します...");
    let mut cmd = std::process::Command::new(&yt_dlp_path);
    cmd.args(&[
      "--verbose",
      &url,
      "-o",
      &output_path,
      "--no-check-certificate",
      "--windows-filenames",
    ]);

    if audio_only {
      cmd.args(&["--extract-audio", "--audio-format", "mp3", "--audio-quality", "0"]);
    } else {
      let fmt = preferred_format.as_deref().unwrap_or("mp4");
      if best_quality {
        cmd.args(&["--format", "bestvideo+bestaudio/best", "--merge-output-format", fmt]);
      } else {
        cmd.args(&["--format", "best", "--merge-output-format", fmt]);
      }
    }

    let output = cmd.output();

    match output {
      Ok(output) => {
        if output.status.success() {
          log::info!("コマンド実行が成功しました");

          if Path::new(&output_path).exists() {
            let metadata = std::fs::metadata(&output_path)
              .map_or_else(|_| "不明".to_string(), |m| format!("{} bytes", m.len()));
            log::info!("ファイルが正常に作成されました: {} ({})", output_path, metadata);
            return Ok(());
          } else {
            log::warn!("コマンドは成功しましたが、ファイルが存在しません");
          }
        } else {
          log::error!(
            "コマンド実行エラー: {}",
            String::from_utf8_lossy(&output.stderr)
          );
        }
      }
      Err(e) => {
        log::error!("コマンド実行の開始に失敗: {}", e);
      }
    }

    log::info!("直接実行が失敗したため、ライブラリによる実行を試みます...");
  }

  let result = instance.socket_timeout("15").download_to_async("").await;

  match result {
    Ok(_) => {
      log::info!("Downloaded video successfully.");

      if Path::new(&output_path).exists() {
        let metadata = match std::fs::metadata(&output_path) {
          Ok(meta) => format!("{} bytes", meta.len()),
          Err(_) => "不明".to_string(),
        };
        log::info!("出力ファイル: {} (サイズ: {})", output_path, metadata);
        Ok(())
      } else {
        #[cfg(windows)]
        {
          log::warn!("出力ファイルが存在しません: {}", output_path);
          log::info!("最終手段: 基本的なyt-dlpコマンドを実行します...");

          let status = std::process::Command::new(&yt_dlp_path)
            .args(&[&url, "-o", &output_path])
            .status();

          match status {
            Ok(exit) if exit.success() => {
              if Path::new(&output_path).exists() {
                log::info!("ファイルが作成されました！");
                return Ok(());
              }
            }
            _ => {}
          }

          Err("ダウンロードは成功しましたが、ファイルが見つかりません".to_string())
        }

        #[cfg(not(windows))]
        {
          log::warn!("出力ファイルが存在しません: {}", output_path);
          Err("ファイルのダウンロードに失敗しました".to_string())
        }
      }
    }
    Err(e) => {
      log::error!("ダウンロードエラー: {}", e);
      Err(format!("Error downloading video: {}", e))
    }
  }
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
    log::info!("タイムスタンプを削除したURL: {}", cleaned);
  }

  cleaned
}

/// タイトルを取得する補助関数
async fn get_video_title(url: &str, yt_dlp_path: &str) -> Result<String, String> {
  let mut meta_instance = YoutubeDl::new(url.to_string());
  meta_instance.youtube_dl_path(yt_dlp_path);

  meta_instance
    .socket_timeout("15")
    .flat_playlist(true)
    .extra_arg("--no-check-certificate")
    .extra_arg("--force-ipv4");

  let metadata_result = meta_instance.run_async().await;

  match metadata_result {
    Ok(metadata) => {
      if let Some(playlist) = metadata.clone().into_playlist() {
        log::info!("プレイリストのタイトル: {:?}", playlist.title);
        Ok(sanitize_filename(
          &playlist.title.unwrap_or_else(|| "No Title".to_string()),
        ))
      } else if let Some(video) = metadata.into_single_video() {
        log::info!("ビデオのタイトル: {:?}", video.title);
        Ok(sanitize_filename(
          &video.title.unwrap_or_else(|| "No Title".to_string()),
        ))
      } else {
        Err("Error getting title".to_string())
      }
    }
    Err(e) => {
      log::error!("メタデータ取得エラー: {:?}", e);
      Err(format!("動画情報の取得に失敗しました: {}", e))
    }
  }
}
