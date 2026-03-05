"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useInitialization } from "@/lib/hooks/useInitialization";
import { useTranslation } from "@/lib/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const { state } = useInitialization();
	const { t } = useTranslation();

	useEffect(() => {
		if (state === "needs-setup") {
			router.replace("/setup");
		}
	}, [state, router]);

	if (state !== "ready") {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-3">
					<div className="size-6 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
					<span className="text-sm text-muted-foreground">{t("common.loading")}</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen overflow-hidden">
			<Sidebar />
			<main className="flex-1 overflow-y-auto">{children}</main>
		</div>
	);
}
