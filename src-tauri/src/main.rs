// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use directories::UserDirs;
use std::env;
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
        Ok(metadata) => {
            if let Some(playlist) = metadata.clone().into_playlist() {
                Ok(playlist.title.unwrap_or_else(|| "No Title".to_string()))
            } else if let Some(video) = metadata.into_single_video() {
                Ok(video.title.unwrap_or_else(|| "No Title".to_string()))
            } else {
                Err("Error getting title".to_string())
            }
        }
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

    // メタデータからタイトルを取得
    let mut meta_instance = YoutubeDl::new(url.clone());
    let metadata_result = meta_instance
        .socket_timeout("15")
        .flat_playlist(true)
        .run_async()
        .await;

    let title = match metadata_result {
        Ok(metadata) => {
            if let Some(playlist) = metadata.clone().into_playlist() {
                playlist.title.unwrap_or_else(|| "No Title".to_string())
            } else if let Some(video) = metadata.into_single_video() {
                video.title.unwrap_or_else(|| "No Title".to_string())
            } else {
                return Err("Error getting title".to_string());
            }
        }
        Err(e) => return Err(e.to_string()),
    };

    // 出力ファイル名生成（audio_only によって拡張子が変わる）
    let output_filename = format!("{}.{}", title, if audio_only { "mp3" } else { "mp4" });

    let output_path = if let Some(p) = folder_path {
        if p.trim().is_empty() {
            get_default_download_path(&output_filename)?
        } else {
            format!("{}/{}", p.trim_end_matches('/'), output_filename)
        }
    } else {
        get_default_download_path(&output_filename)?
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

    // 出力ファイルのパス指定
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

/// ダウンロード先ディレクトリが取得できなかった場合の処理を含むヘルパー関数
fn get_default_download_path(filename: &str) -> Result<String, String> {
    UserDirs::new()
        .and_then(|ud| ud.download_dir().and_then(|p| p.to_str().map(String::from)))
        .map(|default_path| format!("{}/{}", default_path.trim_end_matches('/'), filename))
        .ok_or_else(|| "Error getting download directory".to_string())
}

fn main() {
    // GUIアプリ起動時は、シェルの初期設定が読み込まれないため、PATHを明示的に設定する
    // brewでインストールしたyt-dlpがあるパス（例: /usr/local/bin, /opt/homebrew/bin）を先頭に追加
    let brew_paths = "/usr/local/bin:/opt/homebrew/bin";
    let current_path = env::var("PATH").unwrap_or_default();
    let new_path = format!("{}:{}", brew_paths, current_path);
    env::set_var("PATH", new_path);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![download_video, download_metadata])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
