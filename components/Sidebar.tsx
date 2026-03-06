"use client";

import { usePathname } from "next/navigation";
import { useAppVersion } from "@/lib/hooks/useAppVersion";
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
							<a
								key={href}
								href={href}
								className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
									isActive
										? "bg-cyan/15 text-cyan"
										: "text-sidebar-muted hover:text-sidebar-foreground hover:bg-secondary/50"
								}`}
							>
								<Icon className="h-4 w-4" />
								{t(labelKey)}
							</a>
						);
					})}
				</nav>

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
