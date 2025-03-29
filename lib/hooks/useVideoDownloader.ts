import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

export interface VideoMetadata {
	title: string;
	thumbnail?: string;
	duration?: string;
}

export interface VideoDownloaderState {
	url: string;
	folderPath: string;
	audioOnly: boolean;
	bestQuality: boolean;
	downloadSubtitles: boolean;
	preferredFormat: string;
	customFilename: string;
	metadata: VideoMetadata | null;
	status: string;
	downloading: boolean;
	progress: number;
}

export interface VideoDownloaderActions {
	setUrl: (url: string) => void;
	setFolderPath: (path: string) => void;
	setAudioOnly: (value: boolean) => void;
	setBestQuality: (value: boolean) => void;
	setDownloadSubtitles: (value: boolean) => void;
	setPreferredFormat: (format: string) => void;
	setCustomFilename: (filename: string) => void;
	handleDownload: () => Promise<void>;
}

// URLを検証する関数
function isValidUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		return urlObj.protocol === "http:" || urlObj.protocol === "https:";
	} catch {
		return false;
	}
}

// フォルダパスを検証する関数
function isValidFolderPath(path: string): boolean {
	// 空のパスはOK（デフォルトパスを使用する）
	if (!path.trim()) return true;
	
	// 基本的な不正文字チェック
	const invalidChars = /["<>|]/;
	if (invalidChars.test(path)) return false;

	// パスインジェクション攻撃対策
	if (path.includes("..") || path.includes("~")) return false;

	return true;
}

export function useVideoDownloader(): VideoDownloaderState &
	VideoDownloaderActions {
	const [url, setUrlRaw] = useState("");
	const [folderPath, setFolderPathRaw] = useState("");
	const [audioOnly, setAudioOnly] = useState(false);
	const [bestQuality, setBestQuality] = useState(true);
	const [downloadSubtitles, setDownloadSubtitles] = useState(false);
	const [preferredFormat, setPreferredFormat] = useState<string>("mp4");
	const [customFilename, setCustomFilename] = useState("");
	const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
	const [status, setStatus] = useState("");
	const [downloading, setDownloading] = useState(false);
	const [progress, setProgress] = useState(0);

	const debounceTimer = useRef<NodeJS.Timeout | null>(null);

	// URL入力のラッパー関数（検証を追加）
	const setUrl = (newUrl: string) => {
		setUrlRaw(newUrl);
		if (newUrl && !isValidUrl(newUrl)) {
			setStatus("無効なURLです。http://またはhttps://で始まるURLを入力してください。");
		}
	};

	// フォルダパス入力のラッパー関数（検証を追加）
	const setFolderPath = (newPath: string) => {
		if (isValidFolderPath(newPath)) {
			setFolderPathRaw(newPath);
		} else {
			setStatus("無効なフォルダパスです。");
		}
	};

	// ローカルストレージから保存先パスを読み込み
	useEffect(() => {
		const storedPath = localStorage.getItem("folderPath");
		if (storedPath && isValidFolderPath(storedPath)) {
			setFolderPathRaw(storedPath);
		}
	}, []);

	// 保存先パスが変更されたらローカルストレージに保存
	useEffect(() => {
		if (folderPath) {
			localStorage.setItem("folderPath", folderPath);
		}
	}, [folderPath]);

	// URL 入力後1.5秒で自動的にメタデータ取得
	useEffect(() => {
		if (!url) {
			setMetadata(null);
			return;
		}

		// URLが無効な場合は処理しない
		if (!isValidUrl(url)) {
			return;
		}

		if (debounceTimer.current) clearTimeout(debounceTimer.current);
		debounceTimer.current = setTimeout(async () => {
			try {
				const result = await invoke<VideoMetadata>("download_metadata", {
					url,
				});
				setMetadata(result);
				setStatus("メタデータを取得しました");
			} catch (error) {
				setStatus(`メタデータ取得エラー: ${error}`);
			}
		}, 1500);

		return () => {
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
		};
	}, [url]);

	// ダウンロード進捗のシミュレーション
	useEffect(() => {
		if (downloading) {
			const interval = setInterval(() => {
				setProgress((prev) => {
					const newProgress = prev + Math.random() * 10;
					return newProgress >= 100 ? 100 : newProgress;
				});
			}, 500);

			return () => {
				clearInterval(interval);
				setProgress(0);
			};
		}
	}, [downloading]);

	const handleDownload = async () => {
		if (!url) {
			setStatus("動画URLを入力してください");
			return;
		}

		// URLが無効な場合は処理しない
		if (!isValidUrl(url)) {
			setStatus("無効なURLです。http://またはhttps://で始まるURLを入力してください。");
			return;
		}

		// フォルダパスが無効な場合は処理しない
		if (folderPath && !isValidFolderPath(folderPath)) {
			setStatus("無効なフォルダパスです。");
			return;
		}

		setStatus("ダウンロード中...");
		setDownloading(true);
		setProgress(0);

		try {
			// download_video コマンドに customFilename を渡す
			await invoke<string>("download_video", {
				url,
				audioOnly,
				folderPath: folderPath === "" ? null : folderPath,
				bestQuality: !audioOnly && bestQuality,
				downloadSubtitles: !audioOnly && downloadSubtitles,
				preferredFormat: !audioOnly ? preferredFormat : null,
				customFilename: customFilename.trim() || null,
			});
			setStatus("ダウンロードが完了しました");
		} catch (error) {
			setStatus(`ダウンロードエラー: ${error}`);
		} finally {
			setDownloading(false);
			setProgress(100);
		}
	};

	return {
		url,
		folderPath,
		audioOnly,
		bestQuality,
		downloadSubtitles,
		preferredFormat,
		customFilename,
		metadata,
		status,
		downloading,
		progress,
		setUrl,
		setFolderPath,
		setAudioOnly,
		setBestQuality,
		setDownloadSubtitles,
		setPreferredFormat,
		setCustomFilename,
		handleDownload,
	};
}
