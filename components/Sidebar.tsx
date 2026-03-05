"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppVersion } from "@/lib/hooks/useAppVersion";
import {
	Sparkles,
	LayoutDashboard,
	Download,
	Clock,
	Settings,
} from "lucide-react";

const navItems = [
	{ href: "/", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/downloads", label: "Downloads", icon: Download },
	{ href: "/history", label: "History", icon: Clock },
	{ href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
	const pathname = usePathname();
	const version = useAppVersion();

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
					{navItems.map(({ href, label, icon: Icon }) => {
						const isActive =
							href === "/" ? pathname === "/" : pathname.startsWith(href);
						return (
							<Link
								key={href}
								href={href}
								className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
									isActive
										? "bg-cyan/15 text-cyan"
										: "text-sidebar-muted hover:text-sidebar-foreground hover:bg-secondary/50"
								}`}
							>
								<Icon className="h-4 w-4" />
								{label}
							</Link>
						);
					})}
				</nav>

				{/* スペーサー */}
				<div className="flex-1" />

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
