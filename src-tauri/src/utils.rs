use regex::Regex;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

static URL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
  Regex::new(r"^(https?://)(www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z0-9]+(/[-a-zA-Z0-9%_.~#+]*)*(\?[;&a-zA-Z0-9%_.~+=-]*)?").unwrap()
});

static INVALID_CHARS_REGEX: LazyLock<Regex> = LazyLock::new(|| {
  Regex::new(r#"[<>:"/\\|?*]"#).unwrap()
});

/// アプリケーションデータディレクトリを取得し、存在しなければ作成する
pub fn ensure_app_data_dir() -> Result<PathBuf, String> {
  let dir = dirs::data_dir()
    .ok_or_else(|| "error.data_dir_failed".to_string())?
    .join("my-video-downloader");

  fs::create_dir_all(&dir)
    .map_err(|e| format!("error.dir_create_failed:{e}"))?;

  Ok(dir)
}

/// ダウンロードディレクトリを取得する
pub fn get_download_dir() -> Result<PathBuf, String> {
  directories::UserDirs::new()
    .and_then(|ud| ud.download_dir().map(PathBuf::from))
    .ok_or_else(|| "error.download_dir_failed".to_string())
}

/// URLが有効かどうかを確認する関数
pub fn is_valid_url(url: &str) -> bool {
  URL_REGEX.is_match(url)
}

/// ファイル名を安全にする関数
pub fn sanitize_filename(input: &str) -> String {
  let sanitized = INVALID_CHARS_REGEX.replace_all(input, "_").to_string();

  // 最大長を制限（ファイルシステムによって異なる可能性があるが、
  // 一般的に安全な値として128文字を使用）
  // 日本語などマルチバイト文字に対応するためcharでスライス
  if sanitized.chars().count() > 128 {
    sanitized.chars().take(128).collect::<String>()
  } else {
    sanitized
  }
}

/// パスが安全かどうかを確認する関数
#[must_use] 
pub fn is_safe_path(path: &Path) -> bool {
  // パスが絶対パスであることを確認
  if !path.is_absolute() {
    return false;
  }

  // パスが現在のディレクトリの上や特権的な場所を指していないことを確認
  let path_str = path.to_string_lossy();
  if path_str.contains("..") || path_str.contains('~') {
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
    if path_str.to_lowercase().contains("windows") || path_str.to_lowercase().contains("system32") {
      return false;
    }
  }

  true
}

/// ダウンロード先ディレクトリが取得できなかった場合の処理を含むヘルパー関数
pub fn get_default_download_path(filename: &str) -> Result<String, String> {
  let download_dir = get_download_dir()?;

  if !download_dir.exists() || !download_dir.is_dir() {
    return Err("error.download_dir_not_exists".to_string());
  }

  let full_path = download_dir.join(filename);

  if !is_safe_path(&full_path) {
    return Err("error.unsafe_path_generated".to_string());
  }

  Ok(full_path.to_string_lossy().to_string())
}
