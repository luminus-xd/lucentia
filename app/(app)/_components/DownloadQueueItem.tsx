"use client";

import { Check, Clock, AlertCircle } from "lucide-react";
import type { QueueItem } from "@/lib/hooks/useDownloadQueue";
import { useTranslation } from "@/lib/i18n";
import { getFormatLabel } from "@/lib/utils";

export function DownloadQueueItem({ item }: { item: QueueItem }) {
	const { t } = useTranslation();

	const downloading = item.status === "downloading";
	const completed = item.status === "completed";
	const queued = item.status === "queued";
	const error = item.status === "error";
	const { progress, metadata, formatKey } = item;

	const title = metadata?.title ?? item.url;
	const thumbnail = metadata?.thumbnail;

	return (
		<div className="flex items-center gap-3.5 rounded-lg bg-[#1E293B] px-4 py-3.5">
			{thumbnail ? (
				<img
					src={thumbnail}
					alt={title}
					className="h-10 w-16 shrink-0 rounded-md object-cover"
				/>
			) : (
				<div className="h-10 w-16 shrink-0 rounded-md bg-[#0F172A]" />
			)}

			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex items-center justify-between gap-3">
					<span className="truncate text-sm font-medium">
						{title}
					</span>
					{downloading ? (
						<span className="shrink-0 font-mono text-xs font-bold text-cyan">
							{progress.percent.toFixed(0)}%
						</span>
					) : completed ? (
						<span className="flex shrink-0 items-center gap-1 text-xs font-medium text-cyan">
							<Check className="size-3" />
							{t("dashboard.done")}
						</span>
					) : error ? (
						<span className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
							<AlertCircle className="size-3" />
							{t("toast.downloadFailed")}
						</span>
					) : queued ? (
						<span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
							<Clock className="size-3" />
							{t("dashboard.queued")}
						</span>
					) : null}
				</div>

				{downloading && (
					<div className="h-1 w-full overflow-hidden rounded-full bg-[#0F172A]">
						<div
							className="h-full rounded-full bg-cyan transition-all duration-300"
							style={{ width: `${progress.percent}%` }}
						/>
					</div>
				)}

				{error && item.error && (
					<p className="truncate text-[11px] text-destructive">
						{item.error}
					</p>
				)}

				<div className="flex items-center gap-3 font-mono text-[11px] text-[#64748B]">
					<span className="text-[#94A3B8]">
						{getFormatLabel(formatKey)}
					</span>
					{downloading && progress.speed && (
						<>
							<span className="text-[#475569]">&middot;</span>
							<span>{progress.speed}</span>
						</>
					)}
					{downloading && progress.eta && (
						<>
							<span className="text-[#475569]">&middot;</span>
							<span>ETA {progress.eta}</span>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
