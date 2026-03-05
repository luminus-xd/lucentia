"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/** ダウンロード済みファイルの情報 */
export interface DownloadedFile {
	id: string;
	title: string;
	filename: string;
	path: string;
	format: string;
	size: number;
	category: "video" | "audio";
	modifiedAt: string;
}

/** ダウンロード済みファイル一覧の取得・操作フック */
export function useDownloadedFiles() {
	const [files, setFiles] = useState<DownloadedFile[]>([]);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		try {
			const result = await invoke<DownloadedFile[]>("list_downloaded_files");
			setFiles(result);
		} catch (e) {
			console.error("ファイル一覧の取得に失敗:", e);
		}
	}, []);

	useEffect(() => {
		refresh().finally(() => setLoading(false));
	}, [refresh]);

	const deleteFiles = useCallback(async (ids: string[]) => {
		try {
			await invoke("delete_downloaded_files", { ids });
			setFiles((prev) => prev.filter((f) => !ids.includes(f.id)));
			toast.success(`${ids.length}件のファイルを削除しました`);
		} catch (e) {
			toast.error("ファイルの削除に失敗しました", {
				description: String(e),
			});
		}
	}, []);

	const openFile = useCallback(async (path: string) => {
		try {
			await invoke("open_file", { path });
		} catch (e) {
			toast.error("ファイルを開けませんでした", {
				description: String(e),
			});
		}
	}, []);

	const openInFolder = useCallback(async (path: string) => {
		try {
			await invoke("open_file_in_folder", { path });
		} catch (e) {
			toast.error("フォルダを開けませんでした", {
				description: String(e),
			});
		}
	}, []);

	return { files, loading, refresh, deleteFiles, openFile, openInFolder };
}
