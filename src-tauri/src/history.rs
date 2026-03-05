use chrono::{DateTime, Local, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::utils::ensure_app_data_dir;

/// ダウンロード履歴の1エントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
  pub id: String,
  pub url: String,
  pub title: String,
  pub format: String,
  pub size: Option<u64>,
  pub status: HistoryStatus,
  pub error_message: Option<String>,
  pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HistoryStatus {
  Success,
  Failed,
}

/// 日付ごとにグループ化された履歴
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryGroup {
  pub label: String,
  pub date: String,
  pub items: Vec<HistoryEntry>,
}

/// ダウンロード統計
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadStats {
  pub today_count: u32,
  pub today_size: u64,
  pub week_count: u32,
  pub week_size: u64,
  pub month_count: u32,
  pub month_size: u64,
  pub month_total: u32,
}

/// 履歴ファイルのパスを取得する
fn history_path() -> Result<PathBuf, String> {
  Ok(ensure_app_data_dir()?.join("history.json"))
}

/// 履歴を全件読み込む（内部用）
fn load_all_entries() -> Result<Vec<HistoryEntry>, String> {
  let path = history_path()?;

  if !path.exists() {
    return Ok(Vec::new());
  }

  let content =
    fs::read_to_string(&path).map_err(|e| format!("履歴ファイルの読み込みに失敗: {e}"))?;

  serde_json::from_str(&content).map_err(|e| {
    log::warn!("履歴ファイルのパースに失敗: {e}");
    format!("履歴ファイルのパースに失敗: {e}")
  })
}

/// 履歴を保存する（内部用）
fn save_all_entries(entries: &[HistoryEntry]) -> Result<(), String> {
  let path = history_path()?;

  let content = serde_json::to_string_pretty(entries)
    .map_err(|e| format!("履歴のシリアライズに失敗: {e}"))?;

  fs::write(&path, content).map_err(|e| format!("履歴ファイルの書き込みに失敗: {e}"))?;
  Ok(())
}

/// 日付ラベルを生成する
fn format_date_label(date: NaiveDate, today: NaiveDate, yesterday: NaiveDate) -> (String, String) {
  let formatted = date.format("%B %-d, %Y").to_string().to_uppercase();
  let label = if date == today {
    format!("TODAY — {formatted}")
  } else if date == yesterday {
    format!("YESTERDAY — {formatted}")
  } else {
    formatted
  };
  (label, date.format("%Y-%m-%d").to_string())
}

/// 履歴エントリを追加する
pub fn add_entry(entry: HistoryEntry) -> Result<(), String> {
  let mut entries = load_all_entries()?;
  entries.insert(0, entry);

  // 最大1000件に制限
  entries.truncate(1000);

  save_all_entries(&entries)?;
  log::info!("履歴エントリを追加しました (総数: {})", entries.len());
  Ok(())
}

/// 日付ごとにグループ化した履歴を取得する
pub fn get_grouped_history() -> Result<Vec<HistoryGroup>, String> {
  let entries = load_all_entries()?;
  let now = Local::now();
  let today = now.date_naive();
  let yesterday = today - chrono::Duration::days(1);

  let mut groups: Vec<HistoryGroup> = Vec::new();

  for entry in entries {
    let entry_local: DateTime<Local> = entry.timestamp.into();
    let entry_date = entry_local.date_naive();
    let (label, date_str) = format_date_label(entry_date, today, yesterday);

    if let Some(group) = groups.iter_mut().find(|g| g.date == date_str) {
      group.items.push(entry);
    } else {
      groups.push(HistoryGroup {
        label,
        date: date_str,
        items: vec![entry],
      });
    }
  }

  Ok(groups)
}

/// ダウンロード統計を計算する
pub fn get_stats() -> Result<DownloadStats, String> {
  let entries = load_all_entries()?;
  let now = Local::now();
  let today = now.date_naive();
  let week_ago = today - chrono::Duration::days(7);
  let month_ago = today - chrono::Duration::days(30);

  let mut stats = DownloadStats {
    today_count: 0,
    today_size: 0,
    week_count: 0,
    week_size: 0,
    month_count: 0,
    month_size: 0,
    month_total: 0,
  };

  for entry in &entries {
    let entry_local: DateTime<Local> = entry.timestamp.into();
    let entry_date = entry_local.date_naive();

    // 過去30日の全エントリ（成功+失敗）をカウント
    if entry_date >= month_ago {
      stats.month_total += 1;
    }

    if entry.status != HistoryStatus::Success {
      continue;
    }

    let size = entry.size.unwrap_or(0);

    if entry_date == today {
      stats.today_count += 1;
      stats.today_size += size;
    }

    if entry_date >= week_ago {
      stats.week_count += 1;
      stats.week_size += size;
    }

    if entry_date >= month_ago {
      stats.month_count += 1;
      stats.month_size += size;
    }
  }

  Ok(stats)
}

/// 全履歴を消去する
pub fn clear_all() -> Result<(), String> {
  let path = history_path()?;

  if path.exists() {
    fs::write(&path, "[]").map_err(|e| format!("履歴のクリアに失敗: {e}"))?;
    log::info!("全履歴を消去しました");
  }

  Ok(())
}
