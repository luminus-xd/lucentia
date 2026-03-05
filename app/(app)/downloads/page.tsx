"use client";

import { useMemo, useRef, useState } from "react";
import { Search, Loader2, FileX, FolderOpen, Trash2 } from "lucide-react";
import { useDownloadedFiles } from "@/lib/hooks/useDownloadedFiles";
import { useTranslation } from "@/lib/i18n";
import { toggleSetItem } from "@/lib/utils";
import { SortDropdown, type SortKey, type SortDir } from "./_components/SortDropdown";
import { FilterDropdown } from "./_components/FilterDropdown";
import { FileTableRow } from "./_components/FileTableRow";

type TabKey = "all" | "video" | "audio";

const TAB_KEYS: TabKey[] = ["all", "video", "audio"];

export default function DownloadsPage() {
	const { t } = useTranslation();
	const { files, loading, deleteFiles, openFile, openInFolder } =
		useDownloadedFiles();
	const tabLabels: Record<TabKey, string> = {
		all: t("downloads.allFiles"),
		video: t("downloads.videos"),
		audio: t("downloads.audio"),
	};

	const [activeTab, setActiveTab] = useState<TabKey>("all");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	const [sortKey, setSortKey] = useState<SortKey>("date");
	const [sortDir, setSortDir] = useState<SortDir>("desc");

	const [filterFormats, setFilterFormats] = useState<Set<string>>(new Set());

	const availableFormats = useMemo(
		() => [...new Set(files.map((f) => f.format))].sort(),
		[files],
	);

	const filteredFiles = useMemo(() => {
		const result = files
			.filter((f) => activeTab === "all" || f.category === activeTab)
			.filter((f) =>
				searchQuery === ""
					? true
					: f.title.toLowerCase().includes(searchQuery.toLowerCase()),
			)
			.filter((f) =>
				filterFormats.size === 0 ? true : filterFormats.has(f.format),
			);

		result.sort((a, b) => {
			let cmp = 0;
			switch (sortKey) {
				case "name":
					cmp = a.title.localeCompare(b.title);
					break;
				case "size":
					cmp = a.size - b.size;
					break;
				case "date":
					cmp = a.modifiedAt.localeCompare(b.modifiedAt);
					break;
			}
			return sortDir === "asc" ? cmp : -cmp;
		});

		return result;
	}, [files, activeTab, searchQuery, filterFormats, sortKey, sortDir]);

	const prevFilterKey = useRef({ activeTab, searchQuery, filterFormats });
	if (
		prevFilterKey.current.activeTab !== activeTab ||
		prevFilterKey.current.searchQuery !== searchQuery ||
		prevFilterKey.current.filterFormats !== filterFormats
	) {
		prevFilterKey.current = { activeTab, searchQuery, filterFormats };
		if (selectedIds.size > 0) {
			setSelectedIds(new Set());
		}
	}

	const allSelected =
		filteredFiles.length > 0 &&
		filteredFiles.every((f) => selectedIds.has(f.id));

	const toggleAll = () => {
		if (allSelected) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
		}
	};

	const tabCount = (key: TabKey) =>
		key === "all"
			? files.length
			: files.filter((f) => f.category === key).length;

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
				<Loader2 className="h-6 w-6 animate-spin" />
				<p className="text-sm">{t("downloads.loading")}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 py-8 px-10 h-full">
			{/* Header Row */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">{t("downloads.title")}</h1>
					<p className="text-[13px] text-muted-foreground">
						{t("downloads.description")}
					</p>
				</div>
				<SortDropdown
					sortKey={sortKey}
					sortDir={sortDir}
					onSort={(key, dir) => {
						setSortKey(key);
						setSortDir(dir);
					}}
				/>
			</div>

			{/* Search Row */}
			<div className="flex gap-3">
				<div className="flex-1 flex items-center gap-3 bg-secondary rounded-lg py-3 px-4">
					<Search className="h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={t("downloads.searchPlaceholder")}
						className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
					/>
				</div>
				<FilterDropdown
					formats={availableFormats}
					selected={filterFormats}
					onChangeSelected={setFilterFormats}
				/>
			</div>

			{/* Folder Tabs */}
			<div className="flex bg-secondary rounded-lg p-1 gap-1">
				{TAB_KEYS.map((key) => {
					const isActive = activeTab === key;
					const count = tabCount(key);
					return (
						<button
							type="button"
							key={key}
							onClick={() => setActiveTab(key)}
							className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-mono transition-colors ${
								isActive
									? "bg-background text-cyan"
									: "text-muted-foreground hover:text-foreground/80"
							}`}
						>
							{tabLabels[key]}
							{isActive && (
								<span className="bg-cyan text-cyan-foreground text-[10px] font-bold font-mono rounded px-1.5 py-0.5 leading-none">
									{count}
								</span>
							)}
						</button>
					);
				})}
			</div>

			{/* File Table */}
			<div className="bg-secondary rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
				{/* Table Header */}
				<div className="flex items-center gap-4 px-5 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b border-background/50">
					<div className="w-5 h-5 flex items-center justify-center">
						<input
							type="checkbox"
							checked={allSelected}
							onChange={toggleAll}
							className="w-4 h-4 rounded border-slate-600 bg-transparent accent-cyan cursor-pointer"
						/>
					</div>
					<div className="flex-1">{t("downloads.file")}</div>
					<div className="w-[100px]">{t("downloads.format")}</div>
					<div className="w-[80px]">{t("downloads.size")}</div>
					<div className="w-[100px]">{t("downloads.date")}</div>
					<div className="w-[80px]">{t("downloads.actions")}</div>
				</div>

				{/* Table Body */}
				<div className="flex-1 overflow-y-auto">
					{filteredFiles.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
							<FileX className="h-10 w-10 text-muted-foreground/40" />
							<p className="text-sm">{t("downloads.noFiles")}</p>
						</div>
					) : (
						filteredFiles.map((file, index) => (
							<div key={file.id}>
								{index > 0 && <div className="h-px bg-background" />}
								<FileTableRow
									file={file}
									selected={selectedIds.has(file.id)}
									onToggleSelect={() =>
										setSelectedIds((prev) => toggleSetItem(prev, file.id))
									}
									onOpen={() => openFile(file.path)}
									onOpenInFolder={() => openInFolder(file.path)}
									onDelete={async () => {
										await deleteFiles([file.id]);
										setSelectedIds((prev) => {
											const next = new Set(prev);
											next.delete(file.id);
											return next;
										});
									}}
								/>
							</div>
						))
					)}
				</div>
			</div>

			{/* Bottom Bar */}
			{selectedIds.size > 0 && (
				<div className="flex items-center justify-between bg-secondary rounded-xl py-3.5 px-5">
					<div className="flex items-center gap-2">
						<span className="bg-cyan text-cyan-foreground text-xs font-bold font-mono rounded px-2 py-0.5 leading-none">
							{selectedIds.size}
						</span>
						<span className="text-sm text-muted-foreground">
							{t("downloads.filesSelected", { count: selectedIds.size })}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								const firstSelected = files.find((f) => selectedIds.has(f.id));
								if (firstSelected) openInFolder(firstSelected.path);
							}}
							className="flex items-center gap-2 bg-background rounded-md py-2 px-3.5 text-xs font-medium hover:bg-background/80 transition-colors"
						>
							<FolderOpen className="h-3.5 w-3.5" />
							{t("downloads.openFolder")}
						</button>
						<button
							type="button"
							onClick={async () => {
								await deleteFiles([...selectedIds]);
								setSelectedIds(new Set());
							}}
							className="flex items-center gap-2 bg-background rounded-md py-2 px-3.5 text-xs font-medium text-red-400 hover:bg-background/80 transition-colors"
						>
							<Trash2 className="h-3.5 w-3.5" />
							{t("downloads.delete")}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
