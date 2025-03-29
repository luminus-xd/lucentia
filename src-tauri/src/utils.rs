use regex::Regex;
use std::path::{Path, PathBuf};

/// URLが有効かどうかを確認する関数
pub fn is_valid_url(url: &str) -> bool {
  let url_regex = Regex::new(r"^(https?://)(www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z0-9]+(/[-a-zA-Z0-9%_.~#+]*)*(\?[;&a-zA-Z0-9%_.~+=-]*)?").unwrap();
  url_regex.is_match(url)
}

/// ファイル名を安全にする関数
pub fn sanitize_filename(input: &str) -> String {
  // ファイルシステムで問題となる可能性のある文字を置換
  let invalid_chars = regex::Regex::new(r#"[<>:"/\\|?*]"#).unwrap();
  let sanitized = invalid_chars.replace_all(input, "_").to_string();

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
pub fn is_safe_path(path: &Path) -> bool {
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
    if path_str.to_lowercase().contains("windows") || path_str.to_lowercase().contains("system32") {
      return false;
    }
  }

  true
}

/// ダウンロード先ディレクトリが取得できなかった場合の処理を含むヘルパー関数
pub fn get_default_download_path(filename: &str) -> Result<String, String> {
  let download_dir = directories::UserDirs::new()
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
