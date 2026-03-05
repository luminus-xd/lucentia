"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useHistory, formatBytes } from "@/lib/hooks/useHistory";
import { useVideoDownloader } from "@/lib/hooks/useVideoDownloader";
import {
	ArrowDownToLine,
	Bell,
	Circle,
	Check,
	HardDrive,
	Link,
	ListOrdered,
	TrendingUp,
	Trophy,
} from "lucide-react";

interface QueueItem {
	id: string;
	title: string;
	thumbnail?: string;
	format: string;
	status: "downloading" | "done" | "queued";
	progress?: number;
	speed?: string;
	eta?: string;
}

export default function DashboardPage() {
	const {
		url,
		metadata,
		status,
		downloading,
		progress,
		preferredFormat,
		setUrl,
		setPreferredFormat,
		handleDownload,
	} = useVideoDownloader();

	const { stats: dlStats } = useHistory();

	const queueItems: QueueItem[] = [];

	if (metadata) {
		queueItems.unshift({
			id: "current",
			title: metadata.title,
			thumbnail: metadata.thumbnail,
			format: `MP4 1080p`,
			status: downloading ? "downloading" : "done",
			progress: downloading ? progress : 100,
			speed: downloading ? "2.4 MB/s" : undefined,
			eta: downloading ? "~2:34" : undefined,
		});
	}

	const mockQueue: QueueItem[] = [
		{
			id: "1",
			title: "Building a Design System from Scratch",
			format: "MP4 1080p",
			status: "downloading",
			progress: 67,
			speed: "2.4 MB/s",
			eta: "~2:34",
		},
		{
			id: "2",
			title: "Advanced TypeScript Patterns for React",
			format: "MP4 720p",
			status: "done",
		},
		{
			id: "3",
			title: "The Future of Web Development - Full Conference Talk",
			format: "MP4 1080p",
			status: "queued",
		},
		{
			id: "4",
			title: "Rust for JavaScript Developers - Complete Tutorial",
			format: "MP4 1080p",
			status: "queued",
		},
	];

	const displayQueue = metadata ? queueItems : mockQueue;

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
			value: String(displayQueue.length),
			sub: "processing now",
			subColor: "text-cyan",
			icon: <ListOrdered className="size-4 text-cyan" />,
		},
		{
			label: "SUCCESS RATE",
			value: "98.4%",
			sub: "last 30 days",
			subColor: "text-[#64748B]",
			icon: <Trophy className="size-4 text-[#64748B]" />,
		},
	];

	const formatLabel = (() => {
		switch (preferredFormat) {
			case "mp4":
				return "MP4 1080p";
			case "webm":
				return "WebM 1080p";
			case "mkv":
				return "MKV 1080p";
			default:
				return "MP4 1080p";
		}
	})();

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
							<SelectItem value="mp4">MP4 1080p</SelectItem>
							<SelectItem value="webm">WebM 1080p</SelectItem>
							<SelectItem value="mkv">MKV 1080p</SelectItem>
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
						{displayQueue.length}
					</span>
				</div>

				<div className="flex flex-col gap-2 overflow-y-auto">
					{displayQueue.map((item) => (
						<div
							key={item.id}
							className="flex items-center gap-3.5 rounded-lg bg-[#1E293B] px-4 py-3.5"
						>
							{item.thumbnail ? (
								<img
									src={item.thumbnail}
									alt={item.title}
									className="h-10 w-16 shrink-0 rounded-md object-cover"
								/>
							) : (
								<div className="h-10 w-16 shrink-0 rounded-md bg-[#0F172A]" />
							)}

							<div className="flex min-w-0 flex-1 flex-col gap-1.5">
								<div className="flex items-center justify-between gap-3">
									<span className="truncate text-sm font-medium">
										{item.title}
									</span>
									{item.status === "downloading" && (
										<span className="shrink-0 font-mono text-xs font-bold text-cyan">
											{item.progress}%
										</span>
									)}
									{item.status === "done" && (
										<span className="flex shrink-0 items-center gap-1 text-xs font-medium text-cyan">
											<Check className="size-3" />
											Done
										</span>
									)}
									{item.status === "queued" && (
										<span className="flex shrink-0 items-center gap-1 text-xs text-[#64748B]">
											<Circle className="size-3" />
											Queued
										</span>
									)}
								</div>

								{item.status === "downloading" && (
									<div className="h-1 w-full overflow-hidden rounded-full bg-[#0F172A]">
										<div
											className="h-full rounded-full bg-cyan transition-all duration-300"
											style={{ width: `${item.progress}%` }}
										/>
									</div>
								)}

								<div className="flex items-center gap-3 font-mono text-[11px] text-[#64748B]">
									<span className="text-[#94A3B8]">{item.format}</span>
									{item.speed && (
										<>
											<span className="text-[#475569]">&middot;</span>
											<span>{item.speed}</span>
										</>
									)}
									{item.eta && (
										<>
											<span className="text-[#475569]">&middot;</span>
											<span>{item.eta}</span>
										</>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
