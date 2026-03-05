"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export interface HistoryEntry {
	id: string;
	url: string;
	title: string;
	format: string;
	size: number | null;
	status: "success" | "failed";
	errorMessage: string | null;
	timestamp: string;
}

export interface HistoryGroup {
	label: string;
	date: string;
	items: HistoryEntry[];
}

export interface DownloadStats {
	todayCount: number;
	todaySize: number;
	weekCount: number;
	weekSize: number;
	monthCount: number;
	monthSize: number;
}

const EMPTY_STATS: DownloadStats = {
	todayCount: 0,
	todaySize: 0,
	weekCount: 0,
	weekSize: 0,
	monthCount: 0,
	monthSize: 0,
};

export function useHistory() {
	const [history, setHistory] = useState<HistoryGroup[]>([]);
	const [stats, setStats] = useState<DownloadStats>(EMPTY_STATS);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		try {
			const [h, s] = await Promise.all([
				invoke<HistoryGroup[]>("get_history"),
				invoke<DownloadStats>("get_download_stats"),
			]);
			setHistory(h);
			setStats(s);
		} catch (e) {
			console.error("履歴の読み込みに失敗:", e);
		}
	}, []);

	useEffect(() => {
		refresh().finally(() => setLoading(false));
	}, [refresh]);

	const clearHistory = useCallback(async () => {
		await invoke("clear_history");
		setHistory([]);
		setStats(EMPTY_STATS);
	}, []);

	return { history, stats, loading, refresh, clearHistory };
}

/** バイト数を人間が読みやすい形式にフォーマット */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / 1024 ** i;
	return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
