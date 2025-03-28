// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use directories::UserDirs;
use std::env;
use std::path::{Path, PathBuf};
use youtube_dl::{YoutubeDl, downloader::download_yt_dlp};
use serde::Serialize;
use regex::Regex;

#[derive(Serialize)]
struct VideoMetadata {
    title: String,
    thumbnail: Option<String>,
    duration: Option<String>,
}

/// URLが有効かどうかを確認する関数
fn is_valid_url(url: &str) -> bool {
    let url_regex = Regex::new(r"^(https?://)(www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z0-9]+(/[-a-zA-Z0-9%_.~#+]*)*(\?[;&a-zA-Z0-9%_.~+=-]*)?").unwrap();
    url_regex.is_match(url)
}

/// ファイル名を安全にする関数
fn sanitize_filename(input: &str) -> String {
    // ファイルシステムで問題となる可能性のある文字を置換
    let invalid_chars = regex::Regex::new(r#"[<>:"/\\|?*]"#).unwrap();
    let sanitized = invalid_chars.replace_all(input, "_").to_string();
    
    // 最大長を制限（ファイルシステムによって異なる可能性があるが、
    // 一般的に安全な値として128文字を使用）
    if sanitized.len() > 128 {
        sanitized[..128].to_string()
    } else {
        sanitized
    }
}

/// パスが安全かどうかを確認する関数
fn is_safe_path(path: &Path) -> bool {
    // パスが絶対パスであることを確認
    if !path.is_absolute() {
        return false;
    }
    
    // パスが現在のディレクトリの上や特権的な場所を指していないことを確認
    let path_str = path.to_string_lossy();
    if path_str.contains("..") || path_str.contains("~") {
        return false;
    }
    
    // Unixシステムでは、/etc, /bin, /sbin などの特権的なディレクトリを避ける
    #[cfg(unix)]
    {
        let sensitive_dirs = ["/etc", "/bin", "/sbin", "/usr/bin", "/usr/sbin"];
        if sensitive_dirs.iter().any(|dir| path_str.starts_with(dir)) {
            return false;
        }
    }
    
    // Windowsシステムでは、システムディレクトリを避ける
    #[cfg(windows)]
    {
        if path_str.to_lowercase().contains("windows") || 
           path_str.to_lowercase().contains("system32") {
            return false;
        }
    }
    
    true
}

#[tauri::command]
async fn download_metadata(url: String) -> Result<VideoMetadata, String> {
    println!("Downloading metadata: {}", url);
    
    // URL検証
    if !is_valid_url(&url) {
        return Err("有効なURLではありません".to_string());
    }

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
                let thumbnail = playlist.thumbnails
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
                    video.thumbnails
                        .and_then(|thumbs| thumbs.first().cloned())
                        .and_then(|thumb| thumb.url)
                });
                
                println!("ビデオサムネイル: {:?}", thumbnail);
                
                // durationを安全に変換
                let duration = video.duration.and_then(|d| {
                    if let Some(seconds) = d.as_u64() {
                        Some(format!("{:02}:{:02}", seconds / 60, seconds % 60))
                    } else if let Some(seconds) = d.as_f64() {
                        let seconds = seconds as u64;
                        Some(format!("{:02}:{:02}", seconds / 60, seconds % 60))
                    } else if let Some(s) = d.as_str() {
                        s.parse::<u64>().ok().map(|seconds| {
                            format!("{:02}:{:02}", seconds / 60, seconds % 60)
                        })
                    } else {
                        None
                    }
                });
                
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
    
    // URL検証
    if !is_valid_url(&url) {
        return Err("有効なURLではありません".to_string());
    }

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
    
    // タイトルを安全なファイル名に変換
    let safe_title = sanitize_filename(&title);

    // 出力ファイル名生成（audio_only によって拡張子が変わる）
    let output_filename = format!("{}.{}", safe_title, if audio_only { "mp3" } else { "mp4" });

    // フォルダパスの検証と安全なパスの構築
    let output_path = if let Some(p) = folder_path {
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
    let download_dir = UserDirs::new()
        .and_then(|ud| ud.download_dir().map(PathBuf::from))
        .ok_or_else(|| "Error getting download directory".to_string())?;
    
    // ディレクトリが存在することを確認
    if !download_dir.exists() || !download_dir.is_dir() {
        return Err("ダウンロードディレクトリが存在しないか、ディレクトリではありません".to_string());
    }
    
    let full_path = download_dir.join(filename);
    
    // 安全なパスかどうかを確認
    if !is_safe_path(&full_path) {
        return Err("安全でないパスが生成されました".to_string());
    }
    
    Ok(full_path.to_string_lossy().to_string())
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
        .plugin(tauri_plugin_dialog::init())
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
