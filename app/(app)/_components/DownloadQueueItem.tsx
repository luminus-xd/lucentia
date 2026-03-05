"use client";

import { Check } from "lucide-react";
import type { VideoMetadata, DownloadProgress } from "@/lib/hooks/useVideoDownloader";
import { useTranslation } from "@/lib/i18n";
import { getFormatLabel } from "@/lib/utils";

export function DownloadQueueItem({
	metadata,
	downloading,
	progress,
	formatKey,
}: {
	metadata: VideoMetadata;
	downloading: boolean;
	progress: DownloadProgress;
	formatKey: string;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex items-center gap-3.5 rounded-lg bg-[#1E293B] px-4 py-3.5">
			{metadata.thumbnail ? (
				<img
					src={metadata.thumbnail}
					alt={metadata.title}
					className="h-10 w-16 shrink-0 rounded-md object-cover"
				/>
			) : (
				<div className="h-10 w-16 shrink-0 rounded-md bg-[#0F172A]" />
			)}

			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex items-center justify-between gap-3">
					<span className="truncate text-sm font-medium">
						{metadata.title}
					</span>
					{downloading ? (
						<span className="shrink-0 font-mono text-xs font-bold text-cyan">
							{progress.percent.toFixed(0)}%
						</span>
					) : (
						<span className="flex shrink-0 items-center gap-1 text-xs font-medium text-cyan">
							<Check className="size-3" />
							{t("dashboard.done")}
						</span>
					)}
				</div>

				{downloading && (
					<div className="h-1 w-full overflow-hidden rounded-full bg-[#0F172A]">
						<div
							className="h-full rounded-full bg-cyan transition-all duration-300"
							style={{ width: `${progress.percent}%` }}
						/>
					</div>
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
