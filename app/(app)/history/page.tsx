"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

type HistoryStatus = "success" | "failed";

interface HistoryItem {
	id: string;
	time: string;
	title: string;
	channel: string;
	format: string;
	size: string;
	status: HistoryStatus;
}

interface HistoryGroup {
	label: string;
	items: HistoryItem[];
}

const mockHistory: HistoryGroup[] = [
	{
		label: "TODAY — MARCH 5, 2026",
		items: [
			{
				id: "1",
				time: "14:32",
				title: "React Full Course 2026 - Learn React JS",
				channel: "Fireship",
				format: "MP4 1080p",
				size: "1.2 GB",
				status: "success",
			},
			{
				id: "2",
				time: "13:15",
				title: "Tailwind CSS v4.0 - What's New",
				channel: "Kevin Powell",
				format: "MKV 720p",
				size: "420 MB",
				status: "success",
			},
			{
				id: "3",
				time: "11:48",
				title: "Lo-Fi Hip Hop Radio - Beats to Study To",
				channel: "ChilledCow",
				format: "MP3 320k",
				size: "148 MB",
				status: "success",
			},
			{
				id: "4",
				time: "10:22",
				title: "4K Nature Documentary - Planet Earth III",
				channel: "BBC Earth",
				format: "MP4 4K",
				size: "— —",
				status: "failed",
			},
			{
				id: "5",
				time: "09:05",
				title: "TypeScript Advanced Patterns - Matt Pocock",
				channel: "Matt Pocock",
				format: "MP4 1080p",
				size: "680 MB",
				status: "success",
			},
		],
	},
	{
		label: "YESTERDAY — MARCH 4, 2026",
		items: [
			{
				id: "6",
				time: "22:10",
				title: "Rust Programming Tutorial - Full Course",
				channel: "freeCodeCamp",
				format: "MP4 1080p",
				size: "1.8 GB",
				status: "success",
			},
			{
				id: "7",
				time: "18:45",
				title: "Ambient Music for Coding - 3 Hours",
				channel: "Chill Music Lab",
				format: "MP3 320k",
				size: "216 MB",
				status: "success",
			},
			{
				id: "8",
				time: "14:30",
				title: "Next.js App Router - Complete Guide",
				channel: "Vercel",
				format: "MP4 1080p",
				size: "920 MB",
				status: "success",
			},
		],
	},
];

const statsCards = [
	{ label: "TODAY", value: "12", desc: "downloads", size: "2.4 GB" },
	{ label: "THIS WEEK", value: "47", desc: "downloads", size: "8.7 GB" },
	{ label: "THIS MONTH", value: "156", desc: "downloads", size: "24.8 GB" },
];

export default function HistoryPage() {
	const [history] = useState(mockHistory);

	return (
		<div className="flex h-full flex-col gap-7 overflow-hidden py-8 px-10">
			{/* Header Row */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold leading-tight">History</h1>
					<p className="text-[13px] text-[#64748B]">
						Download activity and timeline
					</p>
				</div>
				<button
					type="button"
					className="flex items-center gap-2 rounded-lg bg-[#1E293B] px-4 py-2.5 text-[13px] font-medium text-[#94A3B8] transition-colors hover:bg-[#1E293B]/80"
				>
					<Trash2 className="size-4" />
					Clear History
				</button>
			</div>

			{/* Stats Row */}
			<div className="grid grid-cols-3 gap-4">
				{statsCards.map((card) => (
					<div
						key={card.label}
						className="flex flex-col gap-3 rounded-xl bg-[#1E293B] p-5"
					>
						<span className="text-[11px] font-semibold tracking-[2px] text-[#64748B] uppercase">
							{card.label}
						</span>
						<span className="font-mono text-[32px] font-bold leading-none">
							{card.value}
						</span>
						<div className="flex items-center justify-between">
							<span className="text-xs text-[#64748B]">{card.desc}</span>
							<span className="font-mono text-xs font-medium text-cyan">
								{card.size}
							</span>
						</div>
					</div>
				))}
			</div>

			{/* Timeline Section */}
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
				{history.map((group, gi) => (
					<div key={group.label} className="flex flex-col gap-4">
						{/* Date Header */}
						<div
							className={`flex items-center gap-3 ${gi > 0 ? "pt-2" : ""}`}
						>
							<span
								className={`shrink-0 font-mono text-[11px] font-bold tracking-[2px] ${
									gi === 0 ? "text-cyan" : "text-[#64748B]"
								}`}
							>
								{group.label}
							</span>
							<div className="h-px flex-1 bg-[#1E293B]" />
						</div>

						{/* History Items */}
						<div className="flex flex-col gap-0.5">
							{group.items.map((item) => (
								<div
									key={item.id}
									className="flex items-center gap-4 rounded-lg bg-[#1E293B] px-4 py-3.5"
								>
									<span className="w-12 shrink-0 font-mono text-[13px] font-semibold text-[#94A3B8]">
										{item.time}
									</span>
									<span
										className={`shrink-0 font-mono text-sm font-bold ${
											item.status === "success"
												? "text-cyan"
												: "text-red-500"
										}`}
									>
										{item.status === "success" ? "✓" : "✗"}
									</span>
									<div className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="truncate text-sm font-medium">
											{item.title}
										</span>
										<span className="font-mono text-[11px] text-[#64748B]">
											{item.channel}
										</span>
									</div>
									<span className="rounded bg-[#0F172A] px-2 py-1 font-mono text-[10px] font-bold text-[#94A3B8]">
										{item.format}
									</span>
									<span
										className={`w-16 text-right font-mono text-xs font-medium ${
											item.status === "failed"
												? "text-[#64748B]"
												: "text-foreground"
										}`}
									>
										{item.size}
									</span>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
