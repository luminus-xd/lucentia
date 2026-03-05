"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useHistory, formatBytes } from "@/lib/hooks/useHistory";
import { useSettings } from "@/lib/hooks/useSettings";
import { useVideoDownloader } from "@/lib/hooks/useVideoDownloader";
import { ensureNotificationPermission } from "@/lib/notifications";
import { FORMAT_OPTIONS, getFormatLabel } from "@/lib/utils";
import {
	ArrowDownToLine,
	Bell,
	Check,
	HardDrive,
	Link,
	ListOrdered,
	TrendingUp,
	Trophy,
} from "lucide-react";
import { useEffect } from "react";

export default function DashboardPage() {
	const { settings } = useSettings();

	const {
		url,
		metadata,
		downloading,
		progress,
		preferredFormat,
		setUrl,
		setPreferredFormat,
		handleDownload,
	} = useVideoDownloader(settings);

	const { stats: dlStats, successRate } = useHistory();

	// 通知がONの場合、権限をリクエストする
	useEffect(() => {
		if (settings.notifComplete || settings.notifError) {
			ensureNotificationPermission();
		}
	}, [settings.notifComplete, settings.notifError]);

	const activeCount = downloading ? 1 : 0;

	const stats = [
		{
			label: "TOTAL DOWNLOADS",
			value: dlStats.monthCount.toLocaleString(),
			sub: `+${dlStats.todayCount} today`,
			subColor: "text-cyan",
			icon: <TrendingUp className="size-4 text-cyan" />,
		},
		{
			label: "STORAGE USED",
			value: formatBytes(dlStats.monthSize),
			sub: "this month",
			subColor: "text-[#64748B]",
			icon: <HardDrive className="size-4 text-[#64748B]" />,
		},
		{
			label: "ACTIVE QUEUE",
			value: String(activeCount),
			sub: "processing now",
			subColor: "text-cyan",
			icon: <ListOrdered className="size-4 text-cyan" />,
		},
		{
			label: "SUCCESS RATE",
			value: successRate != null ? `${successRate}%` : "--",
			sub: "last 30 days",
			subColor: "text-[#64748B]",
			icon: <Trophy className="size-4 text-[#64748B]" />,
		},
	];

	return (
		<div className="flex flex-col gap-7 py-8 px-10">
			{/* Header Row */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-[28px] font-semibold leading-tight">
						Dashboard
					</h1>
					<p className="text-sm text-[#64748B]">
						Download and manage your YouTube videos
					</p>
				</div>
				<button
					type="button"
					className="flex size-10 items-center justify-center rounded-lg bg-[#1E293B] transition-colors hover:bg-[#1E293B]/80"
				>
					<Bell className="size-[18px] text-[#94A3B8]" />
				</button>
			</div>

			{/* URL Input Section */}
			<div className="flex flex-col gap-3">
				<label className="text-[11px] font-semibold tracking-[2px] text-[#64748B] uppercase">
					PASTE URL
				</label>
				<div className="flex gap-3">
					<div className="relative flex-1">
						<Link className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#64748B]" />
						<input
							type="text"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://www.youtube.com/watch?v=..."
							className="h-12 w-full rounded-lg border border-[#22D3EE]/20 bg-[#1E293B] pl-11 pr-4 font-mono text-[13px] text-foreground placeholder:text-[#475569] focus:border-[#22D3EE]/40 focus:outline-none focus:ring-1 focus:ring-[#22D3EE]/30"
						/>
					</div>
					<Select value={preferredFormat} onValueChange={setPreferredFormat}>
						<SelectTrigger className="h-12 w-[160px] rounded-lg border-none bg-[#1E293B] px-4 text-sm font-medium">
							<SelectValue placeholder="MP4 1080p" />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(FORMAT_OPTIONS).map(([value, label]) => (
								<SelectItem key={value} value={value}>
									{label} 1080p
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<button
						type="button"
						onClick={handleDownload}
						disabled={downloading || !url}
						className="flex h-12 items-center gap-2 rounded-lg bg-cyan px-6 font-semibold text-cyan-foreground transition-colors hover:bg-cyan/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Download
						<ArrowDownToLine className="size-4" />
					</button>
				</div>
			</div>

			{/* Stats Row */}
			<div className="grid grid-cols-4 gap-4">
				{stats.map((stat) => (
					<div
						key={stat.label}
						className="flex flex-col gap-3 rounded-xl bg-[#1E293B] p-5"
					>
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-semibold tracking-[2px] text-[#64748B] uppercase">
								{stat.label}
							</span>
							{stat.icon}
						</div>
						<span className="font-mono text-[32px] font-bold leading-none">
							{stat.value}
						</span>
						<span className={`text-xs ${stat.subColor}`}>{stat.sub}</span>
					</div>
				))}
			</div>

			{/* Download Queue Section */}
			<div className="flex min-h-0 flex-1 flex-col gap-4">
				<div className="flex items-center gap-3">
					<span className="text-[11px] font-semibold tracking-[2px] text-[#64748B] uppercase">
						DOWNLOAD QUEUE
					</span>
					<span className="rounded bg-cyan px-2.5 py-1 text-[11px] font-bold text-cyan-foreground">
						{metadata ? 1 : 0}
					</span>
				</div>

				{!metadata ? (
					<div className="flex flex-1 items-center justify-center rounded-lg bg-[#1E293B] py-16">
						<p className="text-sm text-[#64748B]">
							No downloads in queue. Paste a URL above to get started.
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-2 overflow-y-auto">
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
											Done
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
										{getFormatLabel(preferredFormat)}
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
					</div>
				)}
			</div>
		</div>
	);
}
