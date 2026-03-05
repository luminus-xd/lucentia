import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
	showCompletedProgress: boolean;
	statusType: "idle" | "success" | "error";
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
const INVALID_PATH_CHARS = /["<>|]/;
function isValidFolderPath(path: string): boolean {
	// 空のパスはOK（デフォルトパスを使用する）
	if (!path.trim()) return true;

	// 基本的な不正文字チェック
	if (INVALID_PATH_CHARS.test(path)) return false;

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
	const [showCompletedProgress, setShowCompletedProgress] = useState(false);
	const [statusType, setStatusType] = useState<"idle" | "success" | "error">(
		"idle",
	);

	const debounceTimer = useRef<NodeJS.Timeout | null>(null);

	// URL入力のラッパー関数（検証を追加）
	const setUrl = (newUrl: string) => {
		setUrlRaw(newUrl);
		if (!newUrl || isValidUrl(newUrl)) {
			setStatus("");
			return;
		}
		setStatus(
			"無効なURLです。http://またはhttps://で始まるURLを入力してください。",
		);
	};

	// フォルダパス入力のラッパー関数
	const setFolderPath = (newPath: string) => {
		if (!isValidFolderPath(newPath)) {
			setStatus("無効なフォルダパスです。");
			return;
		}
		setFolderPathRaw(newPath);
	};

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

	// Tauri イベントリスナーでダウンロード進捗を取得
	useEffect(() => {
		if (!downloading) return;

		let unlisten: UnlistenFn | undefined;
		listen<{ percent: number }>("download-progress", (event) => {
			setProgress(event.payload.percent);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [downloading]);

	const handleDownload = useCallback(async () => {
		if (!url) {
			setStatus("動画URLを入力してください");
			return;
		}

		// URLが無効な場合は処理しない
		if (!isValidUrl(url)) {
			setStatus(
				"無効なURLです。http://またはhttps://で始まるURLを入力してください。",
			);
			return;
		}

		// フォルダパスが無効な場合は処理しない
		if (folderPath && !isValidFolderPath(folderPath)) {
			setStatus("無効なフォルダパスです。");
			return;
		}

		setStatus("ダウンロード中...");
		setStatusType("idle");
		setDownloading(true);
		setProgress(0);

		try {
			const outputPath = await invoke<string>("download_video", {
				url,
				audioOnly,
				folderPath: folderPath === "" ? null : folderPath,
				bestQuality: !audioOnly && bestQuality,
				downloadSubtitles: !audioOnly && downloadSubtitles,
				preferredFormat: !audioOnly ? preferredFormat : null,
				customFilename: customFilename.trim() || null,
			});
			setProgress(100);
			setStatusType("success");
			setStatus("ダウンロードが完了しました");
			setShowCompletedProgress(true);
			setTimeout(() => setShowCompletedProgress(false), 2000);
			toast.success("ダウンロードが完了しました", {
				description: outputPath,
				duration: 8000,
			});
		} catch (error) {
			setStatusType("error");
			setStatus(`ダウンロードエラー: ${error}`);
			toast.error("ダウンロードに失敗しました", {
				description: String(error),
				duration: 8000,
			});
			setProgress(0);
		} finally {
			setDownloading(false);
		}
	}, [
		url,
		folderPath,
		audioOnly,
		bestQuality,
		downloadSubtitles,
		preferredFormat,
		customFilename,
	]);

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
		showCompletedProgress,
		statusType,
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
