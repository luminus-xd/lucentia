"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface AppSettings {
	initialized: boolean;
	savePath: string;
	defaultFormat: string;
	defaultQuality: string;
	concurrentDownloads: number;
	cookiesBrowser: string | null;
	notifComplete: boolean;
	notifError: boolean;
	notifSound: boolean;
}

export interface SavePathStatus {
	valid: boolean;
	hasVideosDir: boolean;
	hasAudioDir: boolean;
}

const FALLBACK_SETTINGS: AppSettings = {
	initialized: false,
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
	const [savedSettings, setSavedSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
	const [pathStatus, setPathStatus] = useState<SavePathStatus | null>(null);
	const [loading, setLoading] = useState(true);

	const hasChanges = useMemo(
		() => JSON.stringify(settings) !== JSON.stringify(savedSettings),
		[settings, savedSettings],
	);

	useEffect(() => {
		invoke<AppSettings>("get_settings")
			.then(async (s) => {
				setSettings(s);
				setSavedSettings(s);
				const status = await invoke<SavePathStatus>("validate_save_path", {
					path: s.savePath,
				});
				setPathStatus(status);
			})
			.catch((e) => console.error("設定の読み込みに失敗:", e))
			.finally(() => setLoading(false));
	}, []);

	const saveSettings = useCallback(async (updated: AppSettings) => {
		await invoke("save_settings", { newSettings: updated });
		setSettings(updated);
		setSavedSettings(updated);
	}, []);

	const updateField = useCallback(
		<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
			setSettings((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	const changeSavePath = useCallback(async (newPath: string) => {
		const status = await invoke<SavePathStatus>("change_save_path", { newPath });
		setSettings((prev) => ({ ...prev, savePath: newPath }));
		setSavedSettings((prev) => ({ ...prev, savePath: newPath }));
		setPathStatus(status);
	}, []);

	const resetSettings = useCallback(async () => {
		const result = await invoke<{ settings: AppSettings; pathStatus: SavePathStatus }>("reset_settings");
		setSettings(result.settings);
		setSavedSettings(result.settings);
		setPathStatus(result.pathStatus);
	}, []);

	return { settings, pathStatus, loading, hasChanges, saveSettings, updateField, changeSavePath, resetSettings };
}
