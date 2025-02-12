#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::process::Command;
use std::io::{BufReader, BufRead};
use std::path::Path;
use tauri::{Emitter, Window};

#[tauri::command]
async fn download_video(window: Window, url: String, output_path: String) -> Result<String, String> {
    // output_path が空の場合は yt-dlp -e によりタイトルを取得し、ファイル名とする
    let file_name = if output_path.trim().is_empty() {
        let output = Command::new("yt-dlp")
            .args(&["--no-config", "-e", &url])
            .output()
            .map_err(|e| format!("yt-dlp 実行エラー (title取得): {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "yt-dlp エラー (title取得): {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        let title = String::from_utf8(output.stdout)
            .map_err(|e| format!("yt-dlp 出力パースエラー: {}", e))?
            .trim()
            .to_string();
        format!("{}.mp4", title)
    } else {
        output_path.clone()
    };

    // 出力パスが絶対パスでなければ、システムのダウンロードフォルダに結合する
    let full_output_path = {
        let path = Path::new(&file_name);
        if path.is_absolute() {
            file_name
        } else {
            match dirs::download_dir() {
                Some(download_dir) => download_dir.join(file_name).to_string_lossy().into_owned(),
                None => return Err("ダウンロードフォルダが見つかりません".to_string()),
            }
        }
    };

    // yt-dlp の引数リストを組み立てる
    // --newline オプションを追加して、進捗出力が改行区切りになるようにする
    let args = vec![
        "--no-config".to_string(),
        "--newline".to_string(),
        "--merge-output-format".to_string(),
        "mp4".to_string(),
        "-o".to_string(),
        full_output_path.clone(),
        url.clone(),
    ];

    // yt-dlp プロセスを spawn し、stderr から進捗情報を取得
    let mut child = Command::new("yt-dlp")
        .args(&args)
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("yt-dlp spawn エラー: {}", e))?;

    if let Some(stderr) = child.stderr.take() {
        let window_clone = window.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            // lines() イテレータで各行を取得
            for line in reader.lines() {
                if let Ok(line) = line {
                    // 例: "[download]  34.5% of 10.00MiB at 1.23MiB/s ETA 00:05"
                    for token in line.split_whitespace() {
                        if token.ends_with('%') {
                            if let Ok(percent_value) = token.trim_end_matches('%').parse::<f32>() {
                                let _ = window_clone.emit("download-progress", percent_value);
                            }
                        }
                    }
                }
            }
        });
    }

    let status = child.wait().map_err(|e| format!("yt-dlp wait エラー: {}", e))?;
    if status.success() {
        Ok("ダウンロード成功".to_string())
    } else {
        Err("yt-dlp エラー".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![download_video])
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
