"use client";

import { Trash2 } from "lucide-react";
import { useHistory, formatBytes } from "@/lib/hooks/useHistory";
import { useTranslation } from "@/lib/i18n";

/**
 * ISO 8601のタイムスタンプをローカル時刻の "HH:MM" 形式にフォーマットする
 */
function formatTime(timestamp: string): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function HistoryPage() {
	const { history, stats, loading, clearHistory } = useHistory();
	const { t } = useTranslation();

	const statsCards = [
		{ label: t("history.today"), value: String(stats.todayCount), desc: t("history.downloads"), size: formatBytes(stats.todaySize) },
		{ label: t("history.thisWeek"), value: String(stats.weekCount), desc: t("history.downloads"), size: formatBytes(stats.weekSize) },
		{ label: t("history.thisMonth"), value: String(stats.monthCount), desc: t("history.downloads"), size: formatBytes(stats.monthSize) },
	];

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-[13px] text-[#64748B]">{t("history.loading")}</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col gap-7 overflow-hidden py-8 px-10">
			{/* Header Row */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold leading-tight">{t("history.title")}</h1>
					<p className="text-[13px] text-[#64748B]">
						{t("history.description")}
					</p>
				</div>
				<button
					type="button"
					onClick={clearHistory}
					className="flex items-center gap-2 rounded-lg bg-[#1E293B] px-4 py-2.5 text-[13px] font-medium text-[#94A3B8] transition-colors hover:bg-[#1E293B]/80"
				>
					<Trash2 className="size-4" />
					{t("history.clearHistory")}
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
				{history.length === 0 ? (
					<div className="flex flex-1 items-center justify-center">
						<p className="text-[13px] text-[#64748B]">
							{t("history.empty")}
						</p>
					</div>
				) : (
					history.map((group, gi) => (
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
											{formatTime(item.timestamp)}
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
												{item.url}
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
											{item.size != null ? formatBytes(item.size) : "— —"}
										</span>
									</div>
								))}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
