"use client";

import { memo, useRef, useState } from "react";
import { Play, FolderOpen, EllipsisVertical, Trash2 } from "lucide-react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { useTranslation } from "@/lib/i18n";
import { formatBytes } from "@/lib/hooks/useHistory";
import type { DownloadedFile } from "@/lib/hooks/useDownloadedFiles";

export const FileTableRow = memo(function FileTableRow({
	file,
	selected,
	onToggleSelect,
	onOpen,
	onOpenInFolder,
	onDelete,
}: {
	file: DownloadedFile;
	selected: boolean;
	onToggleSelect: () => void;
	onOpen: () => void;
	onOpenInFolder: () => void;
	onDelete: () => void;
}) {
	const { t } = useTranslation();
	const [menuOpen, setMenuOpen] = useState(false);
	const [imgError, setImgError] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	useClickOutside(menuRef, () => setMenuOpen(false));

	return (
		<div className="flex items-center gap-4 px-5 py-3 hover:bg-background/30 transition-colors">
			<div className="w-5 h-5 flex items-center justify-center">
				<input
					type="checkbox"
					checked={selected}
					onChange={onToggleSelect}
					className="w-4 h-4 rounded border-slate-600 bg-transparent accent-cyan cursor-pointer"
				/>
			</div>

			<div className="flex-1 flex items-center gap-3 min-w-0">
				{file.thumbnail && !imgError ? (
					<img
						src={file.thumbnail}
						alt={file.title}
						className="w-16 h-10 rounded-md object-cover flex-shrink-0"
						onError={() => setImgError(true)}
					/>
				) : (
					<div className="w-16 h-10 rounded-md bg-background/60 flex-shrink-0" />
				)}
				<div className="min-w-0">
					<p className="text-sm font-medium truncate">{file.title}</p>
					<p className="text-[11px] font-mono text-muted-foreground truncate">
						{file.filename}
					</p>
				</div>
			</div>

			<div className="w-[100px]">
				<span className={`inline-block text-[10px] font-bold font-mono rounded px-2 py-0.5 leading-tight ${file.category === "audio" ? "bg-amber-500/20 text-amber-400" : "bg-cyan text-cyan-foreground"}`}>
					{file.format}
				</span>
			</div>

			<div className="w-[80px] text-xs font-mono text-slate-400">
				{formatBytes(file.size)}
			</div>

			<div className="w-[100px] text-[11px] font-mono text-muted-foreground">
				{new Date(file.modifiedAt).toLocaleDateString()}
			</div>

			<div className="w-[80px] flex items-center gap-1">
				<button
					type="button"
					onClick={onOpen}
					className="p-1.5 rounded hover:bg-background/50 text-slate-400 transition-colors"
				>
					<Play className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onOpenInFolder}
					className="p-1.5 rounded hover:bg-background/50 text-slate-400 transition-colors"
				>
					<FolderOpen className="h-3.5 w-3.5" />
				</button>

				<div className="relative" ref={menuRef}>
					<button
						type="button"
						onClick={() => setMenuOpen((v) => !v)}
						className="p-1.5 rounded hover:bg-background/50 text-slate-600 transition-colors"
					>
						<EllipsisVertical className="h-3.5 w-3.5" />
					</button>
					{menuOpen && (
						<div className="absolute right-0 top-full mt-1 w-40 bg-secondary border border-border rounded-lg p-1 shadow-lg z-50">
							<button
								type="button"
								onClick={() => {
									onOpen();
									setMenuOpen(false);
								}}
								className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-background/50 transition-colors"
							>
								<Play className="h-3.5 w-3.5" />
								{t("downloads.play")}
							</button>
							<button
								type="button"
								onClick={() => {
									onOpenInFolder();
									setMenuOpen(false);
								}}
								className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-background/50 transition-colors"
							>
								<FolderOpen className="h-3.5 w-3.5" />
								{t("downloads.showInFolder")}
							</button>
							<div className="h-px bg-background my-1" />
							<button
								type="button"
								onClick={() => {
									setMenuOpen(false);
									onDelete();
								}}
								className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-red-400 hover:bg-background/50 transition-colors"
							>
								<Trash2 className="h-3.5 w-3.5" />
								{t("downloads.delete")}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
});
