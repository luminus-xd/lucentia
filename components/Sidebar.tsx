"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppVersion } from "@/lib/hooks/useAppVersion";
import { useDownloadQueue } from "@/lib/hooks/useDownloadQueue";
import { useSetupProgress } from "@/lib/hooks/useSetupProgress";
import { useTranslation } from "@/lib/i18n";
import {
	Sparkles,
	LayoutDashboard,
	Download,
	Clock,
	Settings,
	Loader2,
	Check,
	X,
} from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";
import type { LucideIcon } from "lucide-react";

const navItems: { href: string; labelKey: TranslationKey; icon: LucideIcon }[] = [
	{ href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
	{ href: "/downloads", labelKey: "nav.downloads", icon: Download },
	{ href: "/history", labelKey: "nav.history", icon: Clock },
	{ href: "/settings", labelKey: "nav.settings", icon: Settings },
];

export function Sidebar() {
	const pathname = usePathname();
	const version = useAppVersion();
	const { t } = useTranslation();
	const { steps, isComplete } = useSetupProgress();
	const { queue, activeCount } = useDownloadQueue();
	const downloadingItems = queue.filter((item) => item.status === "downloading");

	return (
		<aside className="w-60 shrink-0 bg-sidebar flex flex-col h-screen border-r border-border/50">
			<div className="flex flex-col flex-1 px-5 py-6 gap-4">
				{/* ロゴ */}
				<div className="flex items-center gap-2.5">
					<Sparkles className="h-6 w-6 text-cyan" />
					<span className="text-lg font-bold font-mono text-sidebar-foreground">
						Lucentia
					</span>
				</div>

				{/* ディバイダー */}
				<div className="h-px bg-secondary" />

				{/* ナビゲーション */}
				<nav className="flex flex-col gap-1 pt-2">
					{navItems.map(({ href, labelKey, icon: Icon }) => {
						const isActive =
							href === "/" ? pathname === "/" : pathname.startsWith(href);
						return (
							<Link
								key={href}
								href={href}
								prefetch={false}
								className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
									isActive
										? "bg-cyan/15 text-cyan"
										: "text-sidebar-muted hover:text-sidebar-foreground hover:bg-secondary/50"
								}`}
							>
								<Icon className="h-4 w-4" />
								{t(labelKey)}
							</Link>
						);
					})}
				</nav>

				{/* アクティブダウンロード */}
				{activeCount > 0 && (
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<div className="size-2 animate-pulse rounded-full bg-cyan" />
							<span className="text-[11px] font-semibold tracking-wider text-[#64748B] uppercase">
								{t("sidebar.activeDownloads", { count: activeCount })}
							</span>
						</div>
						<div className="flex flex-col gap-1.5">
							{downloadingItems.map((item) => (
								<div key={item.id} className="flex flex-col gap-1 rounded-md bg-secondary/30 px-3 py-2">
									<span className="truncate text-xs text-sidebar-foreground">
										{item.metadata?.title ?? item.url}
									</span>
									<div className="flex items-center gap-2">
										<div className="h-1 flex-1 overflow-hidden rounded-full bg-[#0F172A]">
											<div
												className="h-full rounded-full bg-cyan transition-all duration-300"
												style={{ width: `${item.progress.percent}%` }}
											/>
										</div>
										<span className="shrink-0 font-mono text-[10px] text-cyan">
											{item.progress.percent.toFixed(0)}%
										</span>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* スペーサー */}
				<div className="flex-1" />

				{/* セットアップ進捗 */}
				{!isComplete && (
					<div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
						<div className="flex items-center gap-2 mb-2">
							<Loader2 className="h-3.5 w-3.5 animate-spin text-cyan" />
							<span className="text-xs font-medium text-sidebar-foreground">
								{t("setupProgress.title")}
							</span>
						</div>
						<div className="flex flex-col gap-1.5">
							{(["yt-dlp", "ffmpeg", "deno"] as const).map((step) => (
								<div key={step} className="flex items-center gap-2">
									{steps[step] === "ready" ? (
										<Check className="h-3 w-3 text-emerald-400" />
									) : steps[step] === "error" ? (
										<X className="h-3 w-3 text-red-400" />
									) : steps[step] === "in_progress" ? (
										<Loader2 className="h-3 w-3 animate-spin text-cyan" />
									) : (
										<div className="h-3 w-3 rounded-full border border-sidebar-muted" />
									)}
									<span className="text-[11px] text-sidebar-muted">{step}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* アプリバージョン */}
				{version && (
					<div className="px-1 pb-1">
						<span className="text-xs text-sidebar-muted font-mono">
							Lucentia v{version}
						</span>
					</div>
				)}
			</div>
		</aside>
	);
}
