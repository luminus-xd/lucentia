"use client";

import { useState } from "react";
import {
	Search,
	SlidersHorizontal,
	Play,
	FolderOpen,
	EllipsisVertical,
	Share2,
	Trash2,
	Loader2,
	FileX,
} from "lucide-react";
import { useDownloadedFiles } from "@/lib/hooks/useDownloadedFiles";
import { formatBytes } from "@/lib/hooks/useHistory";

type TabKey = "all" | "video" | "audio";

const TABS: { key: TabKey; label: string }[] = [
	{ key: "all", label: "All Files" },
	{ key: "video", label: "Videos" },
	{ key: "audio", label: "Audio" },
];

export default function DownloadsPage() {
	const { files, loading, deleteFiles, openFile, openInFolder } =
		useDownloadedFiles();
	const [activeTab, setActiveTab] = useState<TabKey>("all");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	const filteredFiles = files
		.filter((f) => activeTab === "all" || f.category === activeTab)
		.filter((f) =>
			searchQuery === ""
				? true
				: f.title.toLowerCase().includes(searchQuery.toLowerCase()),
		);

	const allSelected =
		filteredFiles.length > 0 &&
		filteredFiles.every((f) => selectedIds.has(f.id));

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

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
				<button className="flex items-center gap-2 bg-secondary rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-secondary/80 transition-colors">
					<SlidersHorizontal className="h-4 w-4" />
					Sort
				</button>
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
				<button className="flex items-center gap-2 bg-secondary rounded-lg py-3 px-4 text-sm text-slate-400 hover:bg-secondary/80 transition-colors">
					<SlidersHorizontal className="h-4 w-4" />
					Filter
				</button>
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
											onChange={() => toggleSelect(file.id)}
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
										<button className="p-1.5 rounded hover:bg-background/50 text-slate-600 transition-colors">
											<EllipsisVertical className="h-3.5 w-3.5" />
										</button>
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
						<button className="flex items-center gap-2 bg-background rounded-md py-2 px-3.5 text-xs font-medium hover:bg-background/80 transition-colors">
							<FolderOpen className="h-3.5 w-3.5" />
							Open Folder
						</button>
						<button className="flex items-center gap-2 bg-background rounded-md py-2 px-3.5 text-xs font-medium hover:bg-background/80 transition-colors">
							<Share2 className="h-3.5 w-3.5" />
							Share
						</button>
						<button
							onClick={() => {
								deleteFiles([...selectedIds]);
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
