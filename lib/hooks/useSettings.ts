"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export interface AppSettings {
	savePath: string;
	defaultFormat: string;
	defaultQuality: string;
	concurrentDownloads: number;
	cookiesBrowser: string | null;
	notifComplete: boolean;
	notifError: boolean;
	notifSound: boolean;
}

const FALLBACK_SETTINGS: AppSettings = {
	savePath: "~/Downloads",
	defaultFormat: "mp4",
	defaultQuality: "1080p",
	concurrentDownloads: 3,
	cookiesBrowser: null,
	notifComplete: true,
	notifError: true,
	notifSound: false,
};

export function useSettings() {
	const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		invoke<AppSettings>("get_settings")
			.then(setSettings)
			.catch((e) => console.error("設定の読み込みに失敗:", e))
			.finally(() => setLoading(false));
	}, []);

	const saveSettings = useCallback(async (updated: AppSettings) => {
		await invoke("save_settings", { newSettings: updated });
		setSettings(updated);
	}, []);

	const updateField = useCallback(
		<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
			setSettings((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	return { settings, loading, saveSettings, updateField };
}
