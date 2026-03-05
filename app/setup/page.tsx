"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { open } from "@tauri-apps/plugin-dialog";
import { Sparkles, Folder, ArrowRight, Loader2 } from "lucide-react";
import { useInitialization } from "@/lib/hooks/useInitialization";

export default function SetupPage() {
	const router = useRouter();
	const { initialize } = useInitialization();
	const [savePath, setSavePath] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const handleBrowse = async () => {
		const selected = await open({ directory: true, multiple: false });
		if (selected) {
			const base = `${selected}/Lucentia`;
			setSavePath(base);
			setError("");
		}
	};

	const handleSubmit = async () => {
		if (!savePath.trim()) {
			setError("保存先を選択してください");
			return;
		}

		setSubmitting(true);
		setError("");

		try {
			await initialize(savePath);
			router.push("/");
		} catch (e) {
			setError(String(e));
			setSubmitting(false);
		}
	};

	return (
		<div className="flex h-screen items-center justify-center bg-background">
			<div className="flex w-full max-w-lg flex-col items-center gap-10 px-8">
				{/* Logo & Welcome */}
				<div className="flex flex-col items-center gap-4">
					<div className="flex size-16 items-center justify-center rounded-2xl bg-cyan/10">
						<Sparkles className="size-8 text-cyan" />
					</div>
					<div className="flex flex-col items-center gap-2">
						<h1 className="text-3xl font-bold font-mono">Lucentia</h1>
						<p className="text-sm text-muted-foreground text-center leading-relaxed">
							ようこそ！はじめに動画の保存先フォルダを選択してください。
							<br />
							選択したフォルダ内に「Lucentia」フォルダが作成されます。
						</p>
					</div>
				</div>

				{/* Folder Selection */}
				<div className="flex w-full flex-col gap-3">
					<label className="text-[11px] font-semibold uppercase tracking-[2px] text-muted-foreground">
						保存先フォルダ
					</label>
					<div className="flex gap-2">
						<div className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-[#1E293B] px-4 h-12">
							<Folder className="size-4 shrink-0 text-muted-foreground" />
							<span
								className={`flex-1 truncate font-mono text-sm ${
									savePath ? "text-foreground" : "text-muted-foreground/50"
								}`}
							>
								{savePath || "フォルダを選択..."}
							</span>
						</div>
						<button
							type="button"
							onClick={handleBrowse}
							className="shrink-0 rounded-lg border border-border bg-[#1E293B] px-5 h-12 text-sm font-medium transition-colors hover:bg-[#1E293B]/80"
						>
							選択
						</button>
					</div>
					{error && (
						<p className="text-xs text-red-400">{error}</p>
					)}
				</div>

				{/* Submit */}
				<button
					type="button"
					onClick={handleSubmit}
					disabled={submitting || !savePath}
					className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-cyan font-semibold text-cyan-foreground transition-colors hover:bg-cyan/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{submitting ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							セットアップ中...
						</>
					) : (
						<>
							はじめる
							<ArrowRight className="size-4" />
						</>
					)}
				</button>

				{/* Hint */}
				<p className="text-[11px] text-muted-foreground/60 text-center">
					保存先はあとから設定画面で変更できます
				</p>
			</div>
		</div>
	);
}
