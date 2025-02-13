// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use directories::UserDirs;
use youtube_dl::YoutubeDl;
use serde::Serialize;

#[tauri::command]
async fn download_metadata(url: String) -> Result<String, String> {
  println!("Downloading metadata: {}", url);

  let mut instance = YoutubeDl::new(url);
  let result = instance
    .socket_timeout("15")
    .flat_playlist(true)
    .run_async()
    .await;

  println!("Downloaded metadata");

  match result {
    Ok(metadata) => Ok(match metadata.clone().into_playlist() {
      Some(playlist) => playlist.title.unwrap_or("No Title".to_string()),
      None => match metadata.into_single_video() {
        Some(video) => video.title.unwrap_or("No Title".to_string()),
        None => return Err("Error getting title".to_string()),
      },
    }),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
async fn download_video(
  url: String,
  audio_only: bool,
  folder_path: Option<String>,
) -> Result<(), String> {
  println!("Downloading video: {}", url);

  // 自動でメタデータ取得してタイトルを取得
  let mut meta_instance = YoutubeDl::new(url.clone());
  let metadata_result = meta_instance
    .socket_timeout("15")
    .flat_playlist(true)
    .run_async()
    .await;

  let title = match metadata_result {
    Ok(metadata) => {
      match metadata.clone().into_playlist() {
        Some(playlist) => playlist.title.unwrap_or("No Title".to_string()),
        None => match metadata.into_single_video() {
          Some(video) => video.title.unwrap_or("No Title".to_string()),
          None => return Err("Error getting title".to_string()),
        },
      }
    }
    Err(e) => return Err(e.to_string()),
  };

  // 出力ファイル名生成（audio_only によって拡張子が変わる）
  let output_filename = format!("{}.{}", title, if audio_only { "mp3" } else { "mp4" });

  let output_path = match folder_path {
    Some(p) if p.trim() != "" => format!("{}/{}", p.trim_end_matches('/'), output_filename),
    _ => {
      match UserDirs::new().and_then(|ud| ud.download_dir().map(|p| p.to_str().unwrap().to_string())) {
        Some(default_path) => format!("{}/{}", default_path.trim_end_matches('/'), output_filename),
        None => return Err("Error getting download directory".to_string()),
      }
    }
  };

  println!("Output file: {}", output_path);

  let mut instance = YoutubeDl::new(url);
  if audio_only {
    instance
      .extract_audio(true)
      .extra_arg("--audio-format")
      .extra_arg("mp3");
  } else {
    instance
      .extra_arg("--merge-output-format")
      .extra_arg("mp4");
  }

  // 出力ファイル指定
  instance.extra_arg("-o").extra_arg(&output_path);

  println!("Starting download...");
  let result = instance.socket_timeout("15").download_to_async("").await;

  match result {
    Ok(_) => {
      println!("Downloaded video successfully.");
      Ok(())
    }
    Err(e) => Err(format!("Error downloading video: {}", e)),
  }
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![download_video, download_metadata])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
