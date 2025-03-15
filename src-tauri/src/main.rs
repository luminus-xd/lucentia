// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use directories::UserDirs;
use std::env;
use std::path::PathBuf;
use youtube_dl::{YoutubeDl, downloader::download_yt_dlp};
use serde::Serialize;

#[tauri::command]
async fn download_metadata(url: String) -> Result<String, String> {
    println!("Downloading metadata: {}", url);

    // yt-dlpバイナリのパスを取得
    let yt_dlp_path = get_yt_dlp_path().await?;

    let mut instance = YoutubeDl::new(url);
    
    // カスタムパスのyt-dlpバイナリを使用
    instance.youtube_dl_path(&yt_dlp_path);
    
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

#[derive(Serialize)]
struct VideoFormat {
    format_id: String,
    ext: String,
    resolution: String,
}

#[tauri::command]
async fn download_video(
    url: String,
    audio_only: bool,
    folder_path: Option<String>,
    best_quality: bool,
    download_subtitles: bool,
    preferred_format: Option<String>,
) -> Result<(), String> {
    println!("Downloading video: {}", url);

    // yt-dlpバイナリのパスを取得
    let yt_dlp_path = get_yt_dlp_path().await?;

    // メタデータからタイトルを取得
    let mut meta_instance = YoutubeDl::new(url.clone());
    // カスタムパスのyt-dlpバイナリを使用
    meta_instance.youtube_dl_path(&yt_dlp_path);
    
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
    // カスタムパスのyt-dlpバイナリを使用
    instance.youtube_dl_path(&yt_dlp_path);
    
    if audio_only {
        instance
            .extract_audio(true)
            .extra_arg("--audio-format")
            .extra_arg("mp3")
            .extra_arg("--audio-quality")
            .extra_arg("0"); // 最高音質
    } else {
        // ビデオダウンロードの設定
        if best_quality {
            instance
                .format("bestvideo+bestaudio/best") // 最高品質のビデオ+音声
                .extra_arg("--merge-output-format")
                .extra_arg(preferred_format.unwrap_or("mp4".to_string()));
        } else {
            instance
                .format("best") // デフォルトの高品質
                .extra_arg("--merge-output-format")
                .extra_arg(preferred_format.unwrap_or("mp4".to_string()));
        }
    }

    // 字幕のダウンロード設定
    if download_subtitles {
        instance
            .extra_arg("--write-sub")           // 字幕をダウンロード
            .extra_arg("--write-auto-sub")      // 自動生成字幕もダウンロード
            .extra_arg("--sub-format")
            .extra_arg("srt")
            .extra_arg("--embed-subs")          // 字幕を動画に埋め込む
            .extra_arg("--sub-lang")
            .extra_arg("ja,en");                // 日本語と英語の字幕を優先
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

/// yt-dlpバイナリのパスを取得する関数
/// アプリケーションのデータディレクトリにyt-dlpバイナリが存在するかチェックし、
/// 存在しない場合はダウンロードします。
async fn get_yt_dlp_path() -> Result<PathBuf, String> {
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
    let yt_dlp_path = app_data_dir.join(if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" });
    
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
            },
            Err(e) => Err(format!("yt-dlpバイナリのダウンロードに失敗しました: {}", e)),
        }
    } else {
        println!("既存のyt-dlpバイナリを使用します: {:?}", yt_dlp_path);
        Ok(yt_dlp_path)
    }
}

fn main() {
    // 従来のPATH設定も残しておく（ダウンロードに失敗した場合のフォールバック用）
    let brew_paths = "/usr/local/bin:/opt/homebrew/bin";
    let current_path = env::var("PATH").unwrap_or_default();
    let new_path = format!("{}:{}", brew_paths, current_path);
    env::set_var("PATH", new_path);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![download_video, download_metadata])
        .setup(|_app| {
            // yt-dlpバイナリのダウンロードを非同期で実行
            // setupはsyncなので、新しいスレッドで実行
            std::thread::spawn(|| {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    match get_yt_dlp_path().await {
                        Ok(_) => println!("yt-dlpバイナリの準備が完了しました"),
                        Err(e) => eprintln!("yt-dlpバイナリの準備に失敗しました: {}", e),
                    }
                });
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
