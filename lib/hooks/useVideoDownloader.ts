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
	handleDownload: () => Promise<void>;
}

export function useVideoDownloader(): VideoDownloaderState &
	VideoDownloaderActions {
	const [url, setUrl] = useState("");
	const [folderPath, setFolderPath] = useState("");
	const [audioOnly, setAudioOnly] = useState(false);
	const [bestQuality, setBestQuality] = useState(true);
	const [downloadSubtitles, setDownloadSubtitles] = useState(false);
	const [preferredFormat, setPreferredFormat] = useState<string>("mp4");
	const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
	const [status, setStatus] = useState("");
	const [downloading, setDownloading] = useState(false);
	const [progress, setProgress] = useState(0);

	const debounceTimer = useRef<NodeJS.Timeout | null>(null);

	// ローカルストレージから保存先パスを読み込み
	useEffect(() => {
		const storedPath = localStorage.getItem("folderPath");
		if (storedPath) {
			setFolderPath(storedPath);
		}
	}, []);

	// 保存先パスが変更されたらローカルストレージに保存
	useEffect(() => {
		localStorage.setItem("folderPath", folderPath);
	}, [folderPath]);

	// URL 入力後1.5秒で自動的にメタデータ取得
	useEffect(() => {
		if (!url) {
			setMetadata(null);
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
		setStatus("ダウンロード中...");
		setDownloading(true);
		setProgress(0);

		try {
			// download_video コマンドは、メタデータ取得も内部で行うので、外部からは folderPath と audioOnly を渡すだけでよい
			const result = await invoke<string>("download_video", {
				url,
				audioOnly,
				folderPath: folderPath === "" ? null : folderPath,
				bestQuality: !audioOnly && bestQuality,
				downloadSubtitles: !audioOnly && downloadSubtitles,
				preferredFormat: !audioOnly ? preferredFormat : null,
			});
			setStatus(result);
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
		handleDownload,
	};
}
