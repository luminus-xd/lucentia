"use client";

import { useMemo, useRef, useState } from "react";
import {
	Search,
	SlidersHorizontal,
	ArrowUpDown,
	Play,
	FolderOpen,
	EllipsisVertical,
	Trash2,
	Loader2,
	FileX,
	Check,
} from "lucide-react";
import { useDownloadedFiles } from "@/lib/hooks/useDownloadedFiles";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { formatBytes } from "@/lib/hooks/useHistory";

type TabKey = "all" | "video" | "audio";
type SortKey = "date" | "name" | "size";
type SortDir = "asc" | "desc";

const TABS: { key: TabKey; label: string }[] = [
	{ key: "all", label: "All Files" },
	{ key: "video", label: "Videos" },
	{ key: "audio", label: "Audio" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
	{ key: "date", label: "Date" },
	{ key: "name", label: "Name" },
	{ key: "size", label: "Size" },
];

/** Set の要素をトグルする（あれば削除、なければ追加） */
function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
	const next = new Set(set);
	if (next.has(item)) {
		next.delete(item);
	} else {
		next.add(item);
	}
	return next;
}

export default function DownloadsPage() {
	const { files, loading, deleteFiles, openFile, openInFolder } =
		useDownloadedFiles();
	const [activeTab, setActiveTab] = useState<TabKey>("all");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	// Sort state
	const [sortKey, setSortKey] = useState<SortKey>("date");
	const [sortDir, setSortDir] = useState<SortDir>("desc");
	const [sortOpen, setSortOpen] = useState(false);
	const sortRef = useRef<HTMLDivElement>(null);
	useClickOutside(sortRef, () => setSortOpen(false));

	// Filter state
	const [filterFormats, setFilterFormats] = useState<Set<string>>(new Set());
	const [filterOpen, setFilterOpen] = useState(false);
	const filterRef = useRef<HTMLDivElement>(null);
	useClickOutside(filterRef, () => setFilterOpen(false));

	// Context menu state
	const [contextMenuId, setContextMenuId] = useState<string | null>(null);
	const contextRef = useRef<HTMLDivElement>(null);
	useClickOutside(contextRef, () => setContextMenuId(null));

	// ファイルに含まれる全フォーマットを抽出
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

	// フィルタ条件が変わったら選択をクリア
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
				<p className="text-sm">Loading files...</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 py-8 px-10 h-full">
			{/* Header Row */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Downloads</h1>
					<p className="text-[13px] text-muted-foreground">
						Manage your downloaded files
					</p>
				</div>

				{/* Sort Dropdown */}
				<div className="relative" ref={sortRef}>
					<button
						onClick={() => setSortOpen((v) => !v)}
						className="flex items-center gap-2 bg-secondary rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-secondary/80 transition-colors"
					>
						<ArrowUpDown className="h-4 w-4" />
						{SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
					</button>
					{sortOpen && (
						<div className="absolute right-0 top-full mt-1 w-48 bg-secondary border border-border rounded-lg p-1 shadow-lg z-50">
							{SORT_OPTIONS.map((opt) => (
								<button
									key={opt.key}
									onClick={() => {
										if (sortKey === opt.key) {
											setSortDir((d) => (d === "asc" ? "desc" : "asc"));
										} else {
											setSortKey(opt.key);
											setSortDir(opt.key === "name" ? "asc" : "desc");
										}
										setSortOpen(false);
									}}
									className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-sm transition-colors ${
										sortKey === opt.key
											? "bg-background text-cyan"
											: "text-foreground hover:bg-background/50"
									}`}
								>
									{opt.label}
									{sortKey === opt.key && (
										<span className="text-[10px] font-mono text-muted-foreground">
											{sortDir === "asc" ? "ASC" : "DESC"}
										</span>
									)}
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Search Row */}
			<div className="flex gap-3">
				<div className="flex-1 flex items-center gap-3 bg-secondary rounded-lg py-3 px-4">
					<Search className="h-4 w-4 text-muted-foreground" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search files..."
						className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
					/>
				</div>

				{/* Filter Dropdown */}
				<div className="relative" ref={filterRef}>
					<button
						onClick={() => setFilterOpen((v) => !v)}
						className={`flex items-center gap-2 bg-secondary rounded-lg py-3 px-4 text-sm transition-colors ${
							filterFormats.size > 0
								? "text-cyan"
								: "text-slate-400 hover:bg-secondary/80"
						}`}
					>
						<SlidersHorizontal className="h-4 w-4" />
						Filter
						{filterFormats.size > 0 && (
							<span className="bg-cyan text-cyan-foreground text-[10px] font-bold font-mono rounded px-1.5 py-0.5 leading-none">
								{filterFormats.size}
							</span>
						)}
					</button>
					{filterOpen && (
						<div className="absolute right-0 top-full mt-1 w-48 bg-secondary border border-border rounded-lg p-1 shadow-lg z-50">
							{availableFormats.length === 0 ? (
								<p className="px-3 py-2 text-xs text-muted-foreground">
									No formats available
								</p>
							) : (
								<>
									{availableFormats.map((fmt) => (
										<button
											key={fmt}
											onClick={() =>
												setFilterFormats((prev) => toggleSetItem(prev, fmt))
											}
											className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors hover:bg-background/50"
										>
											<div
												className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
													filterFormats.has(fmt)
														? "bg-cyan border-cyan"
														: "border-slate-600"
												}`}
											>
												{filterFormats.has(fmt) && (
													<Check className="h-3 w-3 text-cyan-foreground" />
												)}
											</div>
											<span className="font-mono text-xs">{fmt}</span>
										</button>
									))}
									{filterFormats.size > 0 && (
										<>
											<div className="h-px bg-background my-1" />
											<button
												onClick={() => setFilterFormats(new Set())}
												className="w-full rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-background/50 transition-colors"
											>
												Clear all
											</button>
										</>
									)}
								</>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Folder Tabs */}
			<div className="flex bg-secondary rounded-lg p-1 gap-1">
				{TABS.map((tab) => {
					const isActive = activeTab === tab.key;
					const count = tabCount(tab.key);
					return (
						<button
							key={tab.key}
							onClick={() => setActiveTab(tab.key)}
							className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-mono transition-colors ${
								isActive
									? "bg-background text-cyan"
									: "text-muted-foreground hover:text-foreground/80"
							}`}
						>
							{tab.label}
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
					<div className="flex-1">File</div>
					<div className="w-[100px]">Format</div>
					<div className="w-[80px]">Size</div>
					<div className="w-[100px]">Date</div>
					<div className="w-[80px]">Actions</div>
				</div>

				{/* Table Body */}
				<div className="flex-1 overflow-y-auto">
					{filteredFiles.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
							<FileX className="h-10 w-10 text-muted-foreground/40" />
							<p className="text-sm">No files found</p>
						</div>
					) : (
						filteredFiles.map((file, index) => (
							<div key={file.id}>
								{index > 0 && <div className="h-px bg-background" />}
								<div className="flex items-center gap-4 px-5 py-3 hover:bg-background/30 transition-colors">
									<div className="w-5 h-5 flex items-center justify-center">
										<input
											type="checkbox"
											checked={selectedIds.has(file.id)}
											onChange={() =>
												setSelectedIds((prev) =>
													toggleSetItem(prev, file.id),
												)
											}
											className="w-4 h-4 rounded border-slate-600 bg-transparent accent-cyan cursor-pointer"
										/>
									</div>

									{/* File Cell */}
									<div className="flex-1 flex items-center gap-3 min-w-0">
										<div className="w-16 h-10 rounded-md bg-background/60 flex-shrink-0" />
										<div className="min-w-0">
											<p className="text-sm font-medium truncate">
												{file.title}
											</p>
											<p className="text-[11px] font-mono text-muted-foreground truncate">
												{file.filename}
											</p>
										</div>
									</div>

									{/* Format Badge */}
									<div className="w-[100px]">
										<span className="inline-block bg-cyan text-cyan-foreground text-[10px] font-bold font-mono rounded px-2 py-0.5 leading-tight">
											{file.format}
										</span>
									</div>

									{/* Size */}
									<div className="w-[80px] text-xs font-mono text-slate-400">
										{formatBytes(file.size)}
									</div>

									{/* Date */}
									<div className="w-[100px] text-[11px] font-mono text-muted-foreground">
										{new Date(file.modifiedAt).toLocaleDateString()}
									</div>

									{/* Actions */}
									<div className="w-[80px] flex items-center gap-1">
										<button
											onClick={() => openFile(file.path)}
											className="p-1.5 rounded hover:bg-background/50 text-slate-400 transition-colors"
										>
											<Play className="h-3.5 w-3.5" />
										</button>
										<button
											onClick={() => openInFolder(file.path)}
											className="p-1.5 rounded hover:bg-background/50 text-slate-400 transition-colors"
										>
											<FolderOpen className="h-3.5 w-3.5" />
										</button>

										{/* Context Menu */}
										<div className="relative" ref={contextMenuId === file.id ? contextRef : undefined}>
											<button
												onClick={() =>
													setContextMenuId((prev) =>
														prev === file.id ? null : file.id,
													)
												}
												className="p-1.5 rounded hover:bg-background/50 text-slate-600 transition-colors"
											>
												<EllipsisVertical className="h-3.5 w-3.5" />
											</button>
											{contextMenuId === file.id && (
												<div className="absolute right-0 top-full mt-1 w-40 bg-secondary border border-border rounded-lg p-1 shadow-lg z-50">
													<button
														onClick={() => {
															openFile(file.path);
															setContextMenuId(null);
														}}
														className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-background/50 transition-colors"
													>
														<Play className="h-3.5 w-3.5" />
														Play
													</button>
													<button
														onClick={() => {
															openInFolder(file.path);
															setContextMenuId(null);
														}}
														className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-background/50 transition-colors"
													>
														<FolderOpen className="h-3.5 w-3.5" />
														Show in Folder
													</button>
													<div className="h-px bg-background my-1" />
													<button
														onClick={async () => {
															setContextMenuId(null);
															await deleteFiles([file.id]);
															setSelectedIds((prev) => {
																const next = new Set(prev);
																next.delete(file.id);
																return next;
															});
														}}
														className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-red-400 hover:bg-background/50 transition-colors"
													>
														<Trash2 className="h-3.5 w-3.5" />
														Delete
													</button>
												</div>
											)}
										</div>
									</div>
								</div>
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
							file{selectedIds.size > 1 ? "s" : ""} selected
						</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => {
								const firstSelected = files.find((f) => selectedIds.has(f.id));
								if (firstSelected) openInFolder(firstSelected.path);
							}}
							className="flex items-center gap-2 bg-background rounded-md py-2 px-3.5 text-xs font-medium hover:bg-background/80 transition-colors"
						>
							<FolderOpen className="h-3.5 w-3.5" />
							Open Folder
						</button>
						<button
							onClick={async () => {
								await deleteFiles([...selectedIds]);
								setSelectedIds(new Set());
							}}
							className="flex items-center gap-2 bg-background rounded-md py-2 px-3.5 text-xs font-medium text-red-400 hover:bg-background/80 transition-colors"
						>
							<Trash2 className="h-3.5 w-3.5" />
							Delete
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
