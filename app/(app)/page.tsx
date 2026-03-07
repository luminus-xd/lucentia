"use client";

import { useHistory, formatBytes } from "@/lib/hooks/useHistory";
import { useSettings } from "@/lib/hooks/useSettings";
import { useVideoDownloader } from "@/lib/hooks/useVideoDownloader";
import { useDownloadQueue } from "@/lib/hooks/useDownloadQueue";
import { ensureNotificationPermission } from "@/lib/notifications";
import { useTranslation } from "@/lib/i18n";
import { isAudioFormat } from "@/lib/utils";
import {
	ArrowDownToLine,
	Link,
	ListOrdered,
	TrendingUp,
	Trophy,
	HardDrive,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StatsCard } from "./_components/StatsCard";
import { DownloadQueueItem } from "./_components/DownloadQueueItem";
import { FormatPicker } from "./_components/FormatPicker";

export default function DashboardPage() {
	const { settings } = useSettings();

	const {
		url,
		metadata,
		fetchingMetadata,
		preferredFormat,
		setUrl,
		setPreferredFormat,
	} = useVideoDownloader(settings);

	const { queue, activeCount, addToQueue } = useDownloadQueue();

	const { stats: dlStats, successRate } = useHistory();
	const { t } = useTranslation();

	const handleAddToQueue = () => {
		if (!url) return;

		addToQueue({
			url,
			metadata: metadata ?? null,
			formatKey: preferredFormat,
			audioOnly: isAudioFormat(preferredFormat),
			bestQuality: true,
			downloadSubtitles: false,
			customFilename: "",
			folderPath: "",
		});

		// URL入力をクリア
		setUrl("");
	};

	useEffect(() => {
		if (settings.notifComplete || settings.notifError) {
			ensureNotificationPermission();
		}
	}, [settings.notifComplete, settings.notifError]);

	const [isMac, setIsMac] = useState(false);
	const urlInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setIsMac(/Mac/.test(navigator.platform));

		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			) {
				return;
			}
			if (e.key === "/") {
				e.preventDefault();
				urlInputRef.current?.focus();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	return (
		<div className="flex flex-col gap-7 py-8 px-10">
			{/* Header Row */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-[28px] font-semibold leading-tight">
						{t("dashboard.title")}
					</h1>
					<p className="text-sm text-muted-foreground">
						{t("dashboard.description")}
					</p>
				</div>
			</div>

			{/* URL Input Section */}
			<div className="flex flex-col gap-3">
				<span className="text-[11px] font-semibold tracking-[2px] text-[#64748B] uppercase">
					{t("dashboard.pasteUrl")}
				</span>
				<div className="flex gap-3">
					<div className="relative flex-1">
						<Link className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#64748B]" />
						<input
							ref={urlInputRef}
							type="text"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							onKeyDown={(e) => {
								if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
									e.preventDefault();
									handleAddToQueue();
								}
							}}
							placeholder="https://www.youtube.com/watch?v=..."
							className="h-12 w-full rounded-lg border border-[#22D3EE]/20 bg-[#1E293B] pl-11 pr-14 font-mono text-[13px] text-foreground placeholder:text-[#475569] focus:border-[#22D3EE]/40 focus:outline-none focus:ring-1 focus:ring-[#22D3EE]/30"
						/>
						{url ? (
							<button
								type="button"
								onClick={() => setUrl("")}
								className="absolute top-1/2 right-4 -translate-y-1/2 rounded p-0.5 text-[#64748B] transition-colors hover:text-foreground"
							>
								<X className="size-3.5" />
							</button>
						) : (
							<kbd className="absolute top-1/2 right-4 -translate-y-1/2 rounded bg-[#334155] px-1.5 py-0.5 font-mono text-[10px] text-[#64748B]">
								/
							</kbd>
						)}
					</div>
					<FormatPicker
						value={preferredFormat}
						onChange={setPreferredFormat}
					/>
					<button
						type="button"
						onClick={handleAddToQueue}
						disabled={!url || fetchingMetadata}
						className="flex h-12 items-center gap-2 rounded-lg bg-cyan px-6 font-semibold text-cyan-foreground transition-colors hover:bg-cyan/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{t("dashboard.addToQueue")}
						<span className="flex items-center gap-1">
							<ArrowDownToLine className="size-4" />
							<kbd className="rounded bg-cyan-foreground/20 px-1.5 py-0.5 font-mono text-[10px]">
								{isMac ? "⌘" : "Ctrl+"}↵
							</kbd>
						</span>
					</button>
				</div>
			</div>

			{/* Stats Row */}
			<div className="grid grid-cols-4 gap-4">
				<StatsCard
					label={t("dashboard.totalDownloads")}
					value={dlStats.monthCount.toLocaleString()}
					sub={t("dashboard.todayCount", { count: dlStats.todayCount })}
					subColor="cyan"
					icon={<TrendingUp className="size-4 text-cyan" />}
				/>
				<StatsCard
					label={t("dashboard.storageUsed")}
					value={formatBytes(dlStats.monthSize)}
					sub={t("dashboard.thisMonth")}
					subColor="muted"
					icon={<HardDrive className="size-4 text-[#64748B]" />}
				/>
				<StatsCard
					label={t("dashboard.activeQueue")}
					value={String(activeCount)}
					sub={t("dashboard.processingNow")}
					subColor="cyan"
					icon={<ListOrdered className="size-4 text-cyan" />}
				/>
				<StatsCard
					label={t("dashboard.successRate")}
					value={successRate != null ? `${successRate}%` : "--"}
					sub={t("dashboard.last30Days")}
					subColor="muted"
					icon={<Trophy className="size-4 text-[#64748B]" />}
				/>
			</div>

			{/* Download Queue Section */}
			<div className="flex min-h-0 flex-1 flex-col gap-4">
				<div className="flex items-center gap-3">
					<span className="text-[11px] font-semibold tracking-[2px] text-[#64748B] uppercase">
						{t("dashboard.downloadQueue")}
					</span>
					<span className="rounded bg-cyan px-2.5 py-1 text-[11px] font-bold text-cyan-foreground">
						{queue.filter((q) => q.status !== "completed").length + (fetchingMetadata ? 1 : 0)}
					</span>
				</div>

				{fetchingMetadata ? (
					<div className="flex items-center gap-4 rounded-lg bg-[#1E293B] p-4">
						<div className="size-16 animate-pulse rounded bg-[#334155]" />
						<div className="flex flex-1 flex-col gap-2">
							<div className="h-4 w-3/4 animate-pulse rounded bg-[#334155]" />
							<div className="h-3 w-1/2 animate-pulse rounded bg-[#334155]" />
						</div>
					</div>
				) : null}

				{queue.length > 0 ? (
					<div className="flex flex-col gap-2 overflow-y-auto">
						{queue.map((item) => (
							<DownloadQueueItem key={item.id} item={item} />
						))}
					</div>
				) : !fetchingMetadata ? (
					<div className="flex flex-1 items-center justify-center rounded-lg bg-[#1E293B] py-16">
						<p className="text-sm text-muted-foreground">
							{t("dashboard.queueEmpty")}
						</p>
					</div>
				) : null}
			</div>
		</div>
	);
}
