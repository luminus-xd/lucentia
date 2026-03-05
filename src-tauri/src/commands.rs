use regex::Regex;
use serde::Serialize;

use std::path::Path;
use std::sync::LazyLock;
use tauri::Emitter;
use tokio::io::AsyncBufReadExt;
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
static RE_PROGRESS: LazyLock<Regex> =
  LazyLock::new(|| Regex::new(r"\[download\]\s+(\d+\.?\d*)%").unwrap());

#[derive(Serialize)]
pub struct VideoMetadata {
  pub title: String,
  pub thumbnail: Option<String>,
  pub duration: Option<String>,
}

#[derive(Serialize, Clone)]
struct DownloadProgress {
  percent: f64,
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
#[allow(clippy::too_many_arguments)]
pub async fn download_video(
  app_handle: tauri::AppHandle,
  url: String,
  audio_only: bool,
  folder_path: Option<String>,
  best_quality: bool,
  download_subtitles: bool,
  preferred_format: Option<String>,
  custom_filename: Option<String>,
) -> Result<String, String> {
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

  log::info!("Output file: {}", output_path);

  // yt-dlp コマンド引数の構築
  let format_value = preferred_format.as_deref().unwrap_or("mp4");
  let mut args: Vec<String> = vec![
    "--newline".into(),
    "--socket-timeout".into(),
    "15".into(),
    "--no-check-certificate".into(),
  ];

  #[cfg(windows)]
  args.push("--windows-filenames".into());

  if audio_only {
    args.extend(
      ["--extract-audio", "--audio-format", "mp3", "--audio-quality", "0"]
        .iter()
        .map(|s| s.to_string()),
    );

    #[cfg(windows)]
    args.extend(
      ["--format", "best", "--no-mtime", "--no-part"]
        .iter()
        .map(|s| s.to_string()),
    );
  } else if best_quality {
    args.extend(
      [
        "--format",
        "bestvideo+bestaudio/best",
        "--merge-output-format",
        format_value,
      ]
      .iter()
      .map(|s| s.to_string()),
    );

    #[cfg(windows)]
    args.push("--prefer-ffmpeg".into());
  } else {
    args.extend(
      ["--format", "best", "--merge-output-format", format_value]
        .iter()
        .map(|s| s.to_string()),
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
      .iter()
      .map(|s| s.to_string()),
    );
  }

  args.extend(["-o".to_string(), output_path.clone(), cleaned_url]);

  log::info!("Starting download...");
  log::debug!(
    "実行コマンド: {} {}",
    yt_dlp_path.to_string_lossy(),
    args.join(" ")
  );

  // tokio::process::Command で yt-dlp を起動
  let mut child = tokio::process::Command::new(&yt_dlp_path)
    .args(&args)
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped())
    .spawn()
    .map_err(|e| format!("yt-dlpの起動に失敗しました: {}", e))?;

  let stdout = child
    .stdout
    .take()
    .ok_or("stdoutの取得に失敗しました")?;
  let stderr = child
    .stderr
    .take()
    .ok_or("stderrの取得に失敗しました")?;

  // stderr をバックグラウンドで収集（エラー報告用）
  let stderr_handle = tokio::spawn(async move {
    let reader = tokio::io::BufReader::new(stderr);
    let mut lines = reader.lines();
    let mut output = String::new();
    while let Ok(Some(line)) = lines.next_line().await {
      log::debug!("yt-dlp stderr: {}", line);
      output.push_str(&line);
      output.push('\n');
    }
    output
  });

  // stdout をパースしてダウンロード進捗を取得
  let reader = tokio::io::BufReader::new(stdout);
  let mut lines = reader.lines();
  let uses_separate_streams = best_quality && !audio_only;
  let mut pass: u32 = 0;
  let mut last_raw_percent: f64 = 0.0;
  let mut last_emitted: f64 = 0.0;

  while let Ok(Some(line)) = lines.next_line().await {
    log::debug!("yt-dlp: {}", line);

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
        // 前回より大きい値のときだけ emit（プログレスバーの逆戻りを防止）
        if percent > last_emitted {
          last_emitted = percent;
          let _ = app_handle.emit("download-progress", DownloadProgress { percent });
        }
      }
    } else if (line.contains("[Merger]")
      || line.contains("[ExtractAudio]")
      || line.contains("[FixupM3u8]"))
      && 95.0 > last_emitted
    {
      last_emitted = 95.0;
      let _ = app_handle.emit("download-progress", DownloadProgress { percent: 95.0 });
    }
  }

  let status = child
    .wait()
    .await
    .map_err(|e| format!("プロセスの終了待ちに失敗: {}", e))?;

  let stderr_output = stderr_handle.await.unwrap_or_default();

  if !status.success() {
    log::error!("yt-dlpがエラーで終了しました: {}", stderr_output);
    return Err(format!(
      "ダウンロードに失敗しました: {}",
      stderr_output.lines().last().unwrap_or("不明なエラー")
    ));
  }

  if Path::new(&output_path).exists() {
    let metadata = match std::fs::metadata(&output_path) {
      Ok(meta) => format!("{} bytes", meta.len()),
      Err(_) => "不明".to_string(),
    };
    log::info!("出力ファイル: {} (サイズ: {})", output_path, metadata);
    let _ = app_handle.emit("download-progress", DownloadProgress { percent: 100.0 });
    Ok(output_path)
  } else {
    log::warn!("出力ファイルが存在しません: {}", output_path);
    Err("ダウンロードは成功しましたが、ファイルが見つかりません".to_string())
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
