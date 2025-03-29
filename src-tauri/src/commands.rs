use regex;
use serde::Serialize;
use serde_json;
use std::path::Path;
use uuid::Uuid;
use youtube_dl::YoutubeDl;

use crate::downloader::get_yt_dlp_path;
use crate::utils::{get_default_download_path, is_safe_path, is_valid_url, sanitize_filename};

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
  println!("Downloading metadata: {}", url);

  // URL検証
  if !is_valid_url(&url) {
    return Err("有効なURLではありません".to_string());
  }

  // URLからタイムスタンプパラメータ(t=XX)を削除
  let cleaned_url = if url.contains("&t=") || url.contains("?t=") {
    let re = regex::Regex::new(r"[?&]t=\d+\.?\d*").unwrap();
    let cleaned = re.replace_all(&url, "").to_string();
    println!("タイムスタンプを削除したURL: {}", cleaned);
    cleaned
  } else {
    url.clone()
  };

  // yt-dlpバイナリのパスを取得
  let yt_dlp_path = get_yt_dlp_path().await?;

  let mut instance = YoutubeDl::new(cleaned_url);

  // カスタムパスのyt-dlpバイナリを使用
  instance.youtube_dl_path(&yt_dlp_path);

  // 基本的なオプション設定
  let result = instance
    .socket_timeout("15")
    .flat_playlist(true)
    .extra_arg("--no-check-certificate") // 証明書チェックをスキップ
    .extra_arg("--force-ipv4") // IPv4を強制
    .run_async()
    .await;

  println!("Downloaded metadata");

  match result {
    Ok(metadata) => {
      if let Some(playlist) = metadata.clone().into_playlist() {
        let thumbnail = playlist
          .thumbnails
          .and_then(|thumbs| thumbs.first().cloned())
          .and_then(|thumb| thumb.url);

        println!("プレイリストサムネイル: {:?}", thumbnail);

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

        println!("ビデオサムネイル: {:?}", thumbnail);

        // durationを安全に変換
        let duration = video.duration.and_then(|d| {
          println!("元のduration値: {:?}", d);

          if let Some(seconds) = d.as_u64() {
            println!("整数値として処理: {}", seconds);
            Some(format!("{:02}:{:02}", seconds / 60, seconds % 60))
          } else if let Some(seconds) = d.as_f64() {
            println!("浮動小数点値として処理: {}", seconds);
            let seconds = seconds as u64;
            Some(format!("{:02}:{:02}", seconds / 60, seconds % 60))
          } else if let Some(s) = d.as_str() {
            println!("文字列として処理: {}", s);
            s.parse::<u64>()
              .ok()
              .map(|seconds| format!("{:02}:{:02}", seconds / 60, seconds % 60))
          } else {
            // JSONの値を直接文字列に変換して処理する
            match serde_json::to_string(&d) {
              Ok(json_str) => {
                println!("JSON文字列として処理: {}", json_str);
                // 浮動小数点数を文字列として扱い、整数部分のみを取り出す
                let cleaned = if json_str.contains('.') {
                  json_str.split('.').next().unwrap_or("0").trim_matches('"')
                } else {
                  json_str.trim_matches('"')
                };

                println!("クリーニング後: {}", cleaned);

                match cleaned.parse::<u64>() {
                  Ok(seconds) => {
                    println!("変換後の秒数: {}", seconds);
                    Some(format!("{:02}:{:02}", seconds / 60, seconds % 60))
                  }
                  Err(e) => {
                    println!("変換エラー: {:?}", e);
                    None
                  }
                }
              }
              Err(e) => {
                println!("JSON変換エラー: {:?}", e);
                None
              }
            }
          }
        });

        println!("最終的なduration値: {:?}", duration);

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
  println!("Downloading video: {}", url);

  // URL検証
  if !is_valid_url(&url) {
    return Err("有効なURLではありません".to_string());
  }

  // URLからタイムスタンプパラメータ(t=XX)を削除
  let cleaned_url = if url.contains("&t=") || url.contains("?t=") {
    let re = regex::Regex::new(r"[?&]t=\d+\.?\d*").unwrap();
    let cleaned = re.replace_all(&url, "").to_string();
    println!("タイムスタンプを削除したURL: {}", cleaned);
    cleaned
  } else {
    url.clone()
  };

  // yt-dlpバイナリのパスを取得
  let yt_dlp_path = get_yt_dlp_path().await?;

  // ファイル名の生成 (カスタムかタイトル自動取得)
  let filename_base = if let Some(filename) = custom_filename {
    if filename.trim().is_empty() {
      // 空文字列ならメタデータからタイトルを取得
      get_video_title(&cleaned_url, &yt_dlp_path.to_string_lossy()).await?
    } else {
      // カスタムファイル名を使用
      sanitize_filename(&filename)
    }
  } else {
    // カスタムファイル名が指定されていない場合はメタデータからタイトルを取得
    get_video_title(&cleaned_url, &yt_dlp_path.to_string_lossy()).await?
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
      // 提供されたフォルダパスを検証
      let path = Path::new(&p);
      if !path.exists() || !path.is_dir() {
        return Err("指定されたパスが存在しないか、ディレクトリではありません".to_string());
      }

      let full_path = path.join(&output_filename);
      // 安全なパスかどうかを確認
      if !is_safe_path(&full_path) {
        return Err("安全でないパスが指定されました".to_string());
      }

      full_path.to_string_lossy().to_string()
    }
  } else {
    get_default_download_path(&output_filename)?
  };

  // ファイル名が存在する場合はUUIDを追加して重複を回避
  let output_path = if Path::new(&base_output_path).exists() {
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
    println!("ファイル名の重複を回避: {}", new_path.to_string_lossy());

    new_path.to_string_lossy().to_string()
  } else {
    base_output_path
  };

  println!("Output file: {}", output_path);

  let mut instance = YoutubeDl::new(cleaned_url);
  // カスタムパスのyt-dlpバイナリを使用
  instance.youtube_dl_path(&yt_dlp_path);

  // 基本的なオプション設定
  instance
    .socket_timeout("15")
    .extra_arg("--no-check-certificate") // 証明書チェックをスキップ
    .extra_arg("--verbose"); // 詳細なログを出力

  // Windows環境では単純なパス処理
  #[cfg(windows)]
  {
    // パスに問題があれば、シンプルな名前に変更
    let simple_path = if output_path.contains(" ") {
      // ファイル名を単純化
      let dir = Path::new(&output_path).parent().unwrap_or(Path::new(""));
      let ext = Path::new(&output_path)
        .extension()
        .unwrap_or_else(|| std::ffi::OsStr::new("mp4"));

      // タイトルの先頭部分を抽出（スペースなし）
      let filename_base = Path::new(&output_path)
        .file_stem()
        .unwrap_or_else(|| std::ffi::OsStr::new("video"))
        .to_string_lossy()
        .to_string();

      // スペースを削除し、最初の20文字だけを使用
      let clean_name = filename_base
        .chars()
        .filter(|c| !c.is_whitespace())
        .take(20)
        .collect::<String>();

      let new_path = dir.join(format!("{}.{}", clean_name, ext.to_string_lossy()));
      println!(
        "パス名を単純化: {} -> {}",
        output_path,
        new_path.to_string_lossy()
      );
      new_path.to_string_lossy().to_string()
    } else {
      output_path.clone()
    };

    // 出力パスを更新
    output_path = simple_path;

    // Windows環境でのファイル名処理を追加
    instance.extra_arg("--windows-filenames");
  }

  if audio_only {
    instance
      .extract_audio(true)
      .extra_arg("--audio-format")
      .extra_arg("mp3")
      .extra_arg("--audio-quality")
      .extra_arg("0"); // 最高音質

    // Windows環境（シンプルな設定）
    #[cfg(windows)]
    {
      // Windows環境では特定のオプションを設定
      instance
        .format("best") // 単一フォーマットを選択
        .extra_arg("--no-mtime") // ファイル更新日時を設定しない
        .extra_arg("--no-part") // 部分的なファイルを作成しない
        .extra_arg("--windows-filenames"); // Windowsファイル名の制限に対応
    }
  } else {
    // フォーマット設定（シンプルに保つ）
    let format = match &preferred_format {
      Some(fmt) => fmt.as_str(),
      None => "mp4",
    };

    // 基本設定（環境に関わらず共通）
    instance.format("best"); // 最も互換性の高い単一ストリームを選択

    // 環境に応じた追加設定
    #[cfg(not(windows))]
    {
      if best_quality {
        instance
          .format("bestvideo+bestaudio/best") // 最高品質のビデオ+音声
          .extra_arg("--merge-output-format")
          .extra_arg(format);
      } else {
        instance
          .format("best") // デフォルトの高品質
          .extra_arg("--merge-output-format")
          .extra_arg(format);
      }
    }

    // Windows環境向けのシンプルな設定
    #[cfg(windows)]
    {
      instance.extra_arg("--prefer-ffmpeg");
    }
  }

  // 字幕のダウンロード設定
  if download_subtitles {
    instance
      .extra_arg("--write-sub") // 字幕をダウンロード
      .extra_arg("--write-auto-sub") // 自動生成字幕もダウンロード
      .extra_arg("--sub-format")
      .extra_arg("srt")
      .extra_arg("--embed-subs") // 字幕を動画に埋め込む
      .extra_arg("--sub-lang")
      .extra_arg("ja,en"); // 日本語と英語の字幕を優先
  }

  // 出力ファイルのパス指定
  instance.extra_arg("-o").extra_arg(&output_path);

  println!("Starting download...");

  // yt-dlpコマンドのデバッグ出力
  let debug_cmd = format!(
    "{} --verbose \"{}\" -o \"{}\"",
    yt_dlp_path.to_string_lossy(),
    &url,
    output_path
  );
  println!("実行コマンド（参考）: {}", debug_cmd);

  // Windows環境では直接実行を試みる
  #[cfg(windows)]
  {
    // 標準のyt-dlpコマンドを直接実行
    println!("Windows環境では直接コマンド実行を優先します...");
    let output = std::process::Command::new(&yt_dlp_path)
      .args(&[
        "--verbose",
        &url,
        "-o",
        &output_path,
        "--no-check-certificate",
        "--windows-filenames",
        if audio_only {
          "--extract-audio"
        } else if best_quality {
          "--format"
        } else {
          "--format"
        },
        if audio_only {
          "--audio-format"
        } else if best_quality {
          "bestvideo+bestaudio/best"
        } else {
          "best"
        },
        if audio_only {
          "mp3"
        } else {
          "--merge-output-format"
        },
        if !audio_only { format } else { "" },
      ])
      .output();

    match output {
      Ok(output) => {
        if output.status.success() {
          println!("コマンド実行が成功しました");

          // ファイルの確認
          if Path::new(&output_path).exists() {
            println!("ファイルが正常に作成されました: {}", output_path);
            let metadata = std::fs::metadata(&output_path)
              .map_or_else(|_| "不明".to_string(), |m| format!("{} bytes", m.len()));
            println!("ファイルサイズ: {}", metadata);
            return Ok(());
          } else {
            println!("警告: コマンドは成功しましたが、ファイルが存在しません");
          }
        } else {
          eprintln!(
            "コマンド実行エラー: {}",
            String::from_utf8_lossy(&output.stderr)
          );
        }
      }
      Err(e) => {
        eprintln!("コマンド実行の開始に失敗: {}", e);
      }
    }

    // 直接実行が失敗した場合はライブラリによる実行を試みる
    println!("直接実行が失敗したため、ライブラリによる実行を試みます...");
  }

  let result = instance.socket_timeout("15").download_to_async("").await;

  match result {
    Ok(_) => {
      println!("Downloaded video successfully.");

      // ファイルが存在するか確認
      if Path::new(&output_path).exists() {
        let metadata = match std::fs::metadata(&output_path) {
          Ok(meta) => format!("{} bytes", meta.len()),
          Err(_) => "不明".to_string(),
        };
        println!("出力ファイル: {} (サイズ: {})", output_path, metadata);
        Ok(())
      } else {
        // Windows環境では最後の手段として直接yt-dlpコマンドを実行
        #[cfg(windows)]
        {
          println!("警告: 出力ファイルが存在しません: {}", output_path);
          println!("最終手段: 基本的なyt-dlpコマンドを実行します...");

          let status = std::process::Command::new(&yt_dlp_path)
            .args(&[&url, "-o", &output_path])
            .status();

          match status {
            Ok(exit) if exit.success() => {
              println!("基本コマンドが成功しました");
              if Path::new(&output_path).exists() {
                println!("ファイルが作成されました！");
                return Ok(());
              }
            }
            _ => {}
          }

          Err("ダウンロードは成功しましたが、ファイルが見つかりません".to_string())
        }

        #[cfg(not(windows))]
        {
          println!("警告: 出力ファイルが存在しません: {}", output_path);
          Err("ファイルのダウンロードに失敗しました".to_string())
        }
      }
    }
    Err(e) => {
      eprintln!("ダウンロードエラー: {}", e);
      Err(format!("Error downloading video: {}", e))
    }
  }
}

// タイトルを取得する補助関数
async fn get_video_title(url: &str, yt_dlp_path: &str) -> Result<String, String> {
  // メタデータからタイトルを取得
  let mut meta_instance = YoutubeDl::new(url.to_string());
  // カスタムパスのyt-dlpバイナリを使用
  meta_instance.youtube_dl_path(yt_dlp_path);

  // 基本的なオプション設定
  meta_instance
    .socket_timeout("15")
    .flat_playlist(true)
    .extra_arg("--no-check-certificate") // 証明書チェックをスキップ
    .extra_arg("--force-ipv4"); // IPv4を強制

  let metadata_result = meta_instance.run_async().await;

  match metadata_result {
    Ok(metadata) => {
      if let Some(playlist) = metadata.clone().into_playlist() {
        println!("プレイリストのタイトル: {:?}", playlist.title);
        Ok(sanitize_filename(
          &playlist.title.unwrap_or_else(|| "No Title".to_string()),
        ))
      } else if let Some(video) = metadata.into_single_video() {
        println!("ビデオのタイトル: {:?}", video.title);
        Ok(sanitize_filename(
          &video.title.unwrap_or_else(|| "No Title".to_string()),
        ))
      } else {
        Err("Error getting title".to_string())
      }
    }
    Err(e) => {
      eprintln!("メタデータ取得エラー: {:?}", e);
      Err(format!("動画情報の取得に失敗しました: {}", e))
    }
  }
}
