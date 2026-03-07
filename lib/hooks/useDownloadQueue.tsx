"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { toast } from "sonner";
import { useStableT, useTranslation } from "../i18n";
import {
	notifyDownloadComplete,
	notifyDownloadError,
	warmUpAudioContext,
} from "../notifications";
import { isAudioFormat } from "../utils";
import type { AppSettings } from "./useSettings";
import type { DownloadProgress, VideoMetadata } from "./useVideoDownloader";

/** Tauriイベントから受け取る進捗ペイロード（idを含む） */
interface DownloadProgressEvent {
	id: string;
	percent: number;
	speed: string | null;
	eta: string | null;
}

/** Tauriイベントから受け取るダウンロード完了ペイロード */
interface DownloadCompleteEvent {
	id: string;
	output_path: string;
}

/** Tauriイベントから受け取るダウンロードエラーペイロード */
interface DownloadErrorEvent {
	id: string;
	error: string;
}

/** Rust側のダウンロード状態エントリ */
interface RustDownloadStatus {
	id: string;
	status: "downloading" | "completed" | "error";
	percent: number;
	outputPath: string | null;
	error: string | null;
}

/** キュー内の各ダウンロードアイテム */
export interface QueueItem {
	id: string;
	url: string;
	metadata: VideoMetadata | null;
	formatKey: string;
	audioOnly: boolean;
	bestQuality: boolean;
	downloadSubtitles: boolean;
	customFilename: string;
	folderPath: string;
	status: "queued" | "downloading" | "completed" | "error";
	progress: DownloadProgress;
	error?: string;
}

/** Contextが提供するインターフェース */
interface DownloadQueueContextValue {
	queue: QueueItem[];
	activeCount: number;
	addToQueue: (item: Omit<QueueItem, "id" | "status" | "progress">) => void;
	removeFromQueue: (id: string) => void;
	clearCompleted: () => void;
}

const DEFAULT_CONCURRENT_DOWNLOADS = 3;
const STORAGE_KEY = "lucentia-download-queue";

/** sessionStorageからキューを復元する */
function loadQueueFromStorage(): QueueItem[] {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as QueueItem[];
	} catch {
		return [];
	}
}

/** ステータス変更のあるアイテムのみsessionStorageに保存する（進捗は除外） */
function saveQueueToStorage(queue: QueueItem[]) {
	try {
		// 進捗データはリロード後に不要なので保存時にリセットし、完了済みは除外
		const toSave = queue
			.filter((q) => q.status !== "completed")
			.map((q) => ({
				...q,
				progress: { percent: 0, speed: null, eta: null },
			}));
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
	} catch {
		// ストレージが満杯の場合は無視
	}
}

const DownloadQueueCtx = createContext<DownloadQueueContextValue | null>(null);

export function DownloadQueueProvider({
	children,
	settings,
}: {
	children: ReactNode;
	settings?: AppSettings;
}) {
	const { t } = useTranslation();
	const tRef = useStableT();
	const [queue, setQueue] = useState<QueueItem[]>(() => loadQueueFromStorage());
	const queueRef = useRef(queue);
	queueRef.current = queue;
	const settingsRef = useRef(settings);
	settingsRef.current = settings;
	/** executeDownloadが既に呼ばれたIDを追跡し、二重起動を防ぐ */
	const startedIdsRef = useRef<Set<string>>(new Set());
	/** リカバリー処理が完了したかどうか */
	const recoveredRef = useRef(false);

	const concurrentDownloads =
		settings?.concurrentDownloads ?? DEFAULT_CONCURRENT_DOWNLOADS;

	/** キュー内のアクティブなダウンロード数 */
	const activeCount = queue.filter((item) => item.status === "downloading").length;

	/**
	 * ステータスが変化した時のみsessionStorageに保存する
	 * 進捗更新（毎秒数回）ではスキップし、パフォーマンスを確保する
	 */
	const prevStatusKeyRef = useRef("");
	useEffect(() => {
		const statusKey = queue.map((q) => `${q.id}:${q.status}`).join(",");
		if (statusKey !== prevStatusKeyRef.current) {
			prevStatusKeyRef.current = statusKey;
			saveQueueToStorage(queue);
		}
	}, [queue]);

	/**
	 * マウント時にRust側のダウンロード状態と照合し、
	 * sessionStorageから復元した "downloading" アイテムの実態を確認する
	 *
	 * - Rust側で completed → UI も completed に更新
	 * - Rust側で error → UI も error に更新
	 * - Rust側で downloading → UI維持 + startedIds に追加（再実行しない）
	 * - Rust側に存在しない → error (stale) に更新
	 */
	useEffect(() => {
		if (recoveredRef.current) return;
		recoveredRef.current = true;

		const downloadingItems = queueRef.current.filter(
			(q) => q.status === "downloading",
		);
		if (downloadingItems.length === 0) return;

		invoke<RustDownloadStatus[]>("get_download_statuses")
			.then((statuses) => {
				const statusMap = new Map(statuses.map((s) => [s.id, s]));

				setQueue((prev) =>
					prev.map((q) => {
						if (q.status !== "downloading") return q;

						const rust = statusMap.get(q.id);
						if (!rust) {
							// Rust側に存在しない → 既に完了済みだがイベントを逃した
							return { ...q, status: "error" as const, error: "stale_download" };
						}

						switch (rust.status) {
							case "completed":
								return {
									...q,
									status: "completed" as const,
									progress: { percent: 100, speed: null, eta: null },
								};
							case "error":
								return {
									...q,
									status: "error" as const,
									error: rust.error ?? "unknown",
									progress: { percent: 0, speed: null, eta: null },
								};
							case "downloading":
								// まだRust側で実行中 → startedIdsに追加して再実行を防ぐ
								startedIdsRef.current.add(q.id);
								return {
									...q,
									progress: { percent: rust.percent, speed: null, eta: null },
								};
							default:
								return q;
						}
					}),
				);
			})
			.catch(() => {
				// コマンドが存在しない（古いバックエンド）場合は
				// downloading のままスタックしないよう error にフォールバック
				setQueue((prev) =>
					prev.map((q) =>
						q.status === "downloading"
							? { ...q, status: "error" as const, error: "recovery_failed" }
							: q,
					),
				);
			});
	}, []);

	/**
	 * 単一アイテムのダウンロードを実行する
	 * ステータス更新と通知はイベントリスナー側で一元管理する
	 * ここでは invoke の呼び出しのみ行う
	 */
	const executeDownload = useCallback(async (item: QueueItem) => {
		// ステータスを downloading に更新
		setQueue((prev) =>
			prev.map((q) =>
				q.id === item.id
					? { ...q, status: "downloading" as const, progress: { percent: 0, speed: null, eta: null } }
					: q,
			),
		);

		try {
			await invoke<string>("download_video", {
				downloadId: item.id,
				url: item.url,
				audioOnly: item.audioOnly,
				folderPath: item.folderPath === "" ? null : item.folderPath,
				bestQuality: !item.audioOnly && item.bestQuality,
				downloadSubtitles: !item.audioOnly && item.downloadSubtitles,
				preferredFormat: item.formatKey,
				customFilename: item.customFilename.trim() || null,
				thumbnail: item.metadata?.thumbnail ?? null,
				metadataTitle: item.metadata?.title ?? null,
			});
			// 完了ステータスの更新と通知は download-complete イベントリスナーで行う
		} catch {
			// エラーステータスの更新と通知は download-error イベントリスナーで行う
		}

		startedIdsRef.current.delete(item.id);
	}, []);

	/**
	 * キューを監視し、空きスロットがあれば次のダウンロードを開始する
	 * downloading状態だがstartedIdsに無いアイテム（リロード復元分）はスキップする
	 */
	useEffect(() => {
		const currentActive = queue.filter(
			(item) => item.status === "downloading",
		).length;
		const available = concurrentDownloads - currentActive;

		if (available <= 0) return;

		const pendingItems = queue.filter((item) => item.status === "queued");
		const itemsToStart = pendingItems.slice(0, available);

		for (const item of itemsToStart) {
			if (!startedIdsRef.current.has(item.id)) {
				startedIdsRef.current.add(item.id);
				executeDownload(item);
			}
		}
	}, [queue, concurrentDownloads, executeDownload]);

	/**
	 * Tauriイベントをリッスンする
	 * - download-progress: 進捗更新
	 * - download-complete: ダウンロード完了（通知の一元管理）
	 * - download-error: ダウンロードエラー（通知の一元管理）
	 */
	useEffect(() => {
		let cancelled = false;
		const unlisteners: UnlistenFn[] = [];

		const promises = [
			listen<DownloadProgressEvent>("download-progress", (event) => {
				const { id, percent, speed, eta } = event.payload;
				setQueue((prev) =>
					prev.map((q) =>
						q.id === id && q.status === "downloading"
							? { ...q, progress: { percent, speed, eta } }
							: q,
					),
				);
			}),

			listen<DownloadCompleteEvent>("download-complete", (event) => {
				const { id, output_path } = event.payload;
				const item = queueRef.current.find((q) => q.id === id);
				if (!item || item.status === "completed") return;

				setQueue((prev) =>
					prev.map((q) =>
						q.id === id
							? { ...q, status: "completed" as const, progress: { percent: 100, speed: null, eta: null } }
							: q,
					),
				);

				const t = tRef.current;
				toast.success(t("toast.downloadComplete"), {
					description: output_path,
					duration: 8000,
				});
				notifyDownloadComplete(
					settingsRef.current,
					t("osNotification.downloadComplete"),
					item.metadata?.title,
					output_path,
				);
			}),

			listen<DownloadErrorEvent>("download-error", (event) => {
				const { id, error } = event.payload;
				const item = queueRef.current.find((q) => q.id === id);
				if (!item || item.status === "error" || item.status === "completed") return;

				setQueue((prev) =>
					prev.map((q) =>
						q.id === id
							? {
									...q,
									status: "error" as const,
									progress: { percent: 0, speed: null, eta: null },
									error,
								}
							: q,
					),
				);

				const t = tRef.current;
				toast.error(t("toast.downloadFailed"), {
					description: error,
					duration: 8000,
				});
				notifyDownloadError(
					settingsRef.current,
					t("osNotification.downloadError"),
					error,
				);
			}),
		];

		Promise.all(promises).then((fns) => {
			if (cancelled) {
				for (const fn of fns) fn();
			} else {
				unlisteners.push(...fns);
			}
		});

		return () => {
			cancelled = true;
			for (const unlisten of unlisteners) {
				unlisten();
			}
		};
	}, []);

	/** メタデータが未取得のアイテムに対してバックグラウンドで取得する */
	const fetchMetadataForItem = useCallback(async (id: string, url: string) => {
		try {
			const result = await invoke<VideoMetadata>("download_metadata", { url });
			setQueue((prev) =>
				prev.map((q) =>
					q.id === id && !q.metadata
						? { ...q, metadata: result }
						: q,
				),
			);
		} catch {
			// メタデータ取得失敗してもダウンロード自体には影響しない
		}
	}, []);

	/** キューにアイテムを追加する */
	const addToQueue = useCallback(
		(item: Omit<QueueItem, "id" | "status" | "progress">) => {
			// ユーザージェスチャーのスタック上で AudioContext を初期化
			if (settingsRef.current?.notifSound) {
				warmUpAudioContext();
			}

			const newItem: QueueItem = {
				...item,
				id: crypto.randomUUID(),
				status: "queued",
				progress: { percent: 0, speed: null, eta: null },
			};

			setQueue((prev) => [...prev, newItem]);

			// メタデータが未取得の場合、バックグラウンドで取得
			if (!item.metadata) {
				fetchMetadataForItem(newItem.id, item.url);
			}
		},
		[fetchMetadataForItem],
	);

	/** キューからアイテムを削除する */
	const removeFromQueue = useCallback((id: string) => {
		startedIdsRef.current.delete(id);
		setQueue((prev) => prev.filter((q) => q.id !== id));
	}, []);

	/** 完了済みアイテムをすべてクリアする */
	const clearCompleted = useCallback(() => {
		setQueue((prev) => prev.filter((q) => q.status !== "completed"));
	}, []);

	return (
		<DownloadQueueCtx.Provider
			value={{ queue, activeCount, addToQueue, removeFromQueue, clearCompleted }}
		>
			{children}
		</DownloadQueueCtx.Provider>
	);
}

/** ダウンロードキューContextを使用するフック */
export function useDownloadQueue() {
	const ctx = useContext(DownloadQueueCtx);
	if (!ctx) {
		throw new Error("useDownloadQueue must be used within DownloadQueueProvider");
	}
	return ctx;
}
