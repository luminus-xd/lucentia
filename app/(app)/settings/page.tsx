"use client";

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Download,
	Bell,
	Info,
	TriangleAlert,
	Save,
	Folder,
	ChevronDown,
	RefreshCw,
	Loader2,
	AlertCircle,
	FolderOpen,
	Check,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/lib/hooks/useSettings";

const FORMAT_OPTIONS = ["mp4", "mkv", "webm"] as const;
const BROWSER_OPTIONS = [
	{ value: "", label: "None (disabled)" },
	{ value: "chrome", label: "Chrome" },
	{ value: "firefox", label: "Firefox" },
	{ value: "safari", label: "Safari" },
	{ value: "edge", label: "Edge" },
	{ value: "brave", label: "Brave" },
] as const;

function SectionHeader({
	icon: Icon,
	label,
	muted = false,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	muted?: boolean;
}) {
	return (
		<div className="flex items-center gap-2.5">
			<Icon
				className={`h-5 w-5 ${muted ? "text-muted-foreground" : "text-cyan"}`}
			/>
			<h2
				className={`text-base font-semibold ${muted ? "text-muted-foreground" : ""}`}
			>
				{label}
			</h2>
		</div>
	);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="text-[11px] font-medium uppercase tracking-[2px] text-muted-foreground">
			{children}
		</span>
	);
}

function ToggleRow({
	label,
	description,
	checked,
	onCheckedChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onCheckedChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex flex-col gap-0.5">
				<span className="text-sm font-medium">{label}</span>
				<span className="text-xs text-muted-foreground">{description}</span>
			</div>
			<Switch
				checked={checked}
				onCheckedChange={onCheckedChange}
				className="data-[state=checked]:bg-cyan data-[state=unchecked]:bg-[#475569]"
			/>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-sm text-muted-foreground">{label}</span>
			<span className="text-sm font-semibold font-mono">{value}</span>
		</div>
	);
}

export default function SettingsPage() {
	const { settings, pathStatus, loading, saveSettings, updateField, changeSavePath } = useSettings();
	const [ytDlpVersion, setYtDlpVersion] = useState<string>("...");
	const [updating, setUpdating] = useState(false);
	const [changingPath, setChangingPath] = useState(false);

	useEffect(() => {
		invoke<string>("get_yt_dlp_version")
			.then(setYtDlpVersion)
			.catch(() => setYtDlpVersion("not found"));
	}, []);

	const handleSave = async () => {
		await saveSettings(settings);
		toast.success("Settings saved");
	};

	const handleChangeSavePath = useCallback(async () => {
		const selected = await open({ directory: true, multiple: false });
		if (!selected) return;

		const newPath = `${selected}/Lucentia`;
		setChangingPath(true);
		try {
			await changeSavePath(newPath);
			toast.success("保存先を変更しました", { description: newPath });
		} catch (e) {
			toast.error(`保存先の変更に失敗: ${e}`);
		} finally {
			setChangingPath(false);
		}
	}, [changeSavePath]);

	const handleUpdateYtDlp = useCallback(async () => {
		setUpdating(true);
		try {
			const version = await invoke<string>("update_yt_dlp");
			setYtDlpVersion(version);
			toast.success(`yt-dlp updated to ${version}`);
		} catch (e) {
			toast.error(`Update failed: ${e}`);
		} finally {
			setUpdating(false);
		}
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-muted-foreground">Loading settings...</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-7 p-8 px-10">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-[28px] font-semibold">Settings</h1>
					<p className="text-sm text-muted-foreground">
						Configure your download preferences
					</p>
				</div>
				<button
					type="button"
					onClick={handleSave}
					className="flex items-center gap-2 rounded-lg bg-cyan px-5 h-10 text-sm font-semibold text-cyan-foreground hover:bg-cyan/90 transition-colors"
				>
					<Save className="h-4 w-4" />
					Save Changes
				</button>
			</div>

			{/* Settings Grid */}
			<div className="grid grid-cols-2 gap-6 flex-1">
				{/* Left Column */}
				<div className="flex flex-col gap-6">
					{/* Download Settings */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Download} label="Download Settings" />

						<div className="flex flex-col gap-2">
							<FieldLabel>SAVE LOCATION</FieldLabel>

							{/* パスが無効な場合の警告バナー */}
							{pathStatus && !pathStatus.valid && (
								<div className="flex items-center gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
									<AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
									<div className="flex flex-col gap-0.5">
										<span className="text-xs font-medium text-red-400">
											保存先フォルダが見つかりません
										</span>
										<span className="text-[11px] text-red-400/70">
											フォルダが削除されたか、アクセスできません。新しい保存先を選択してください。
										</span>
									</div>
								</div>
							)}

							<div className="flex items-center gap-2">
								<div className="flex flex-1 items-center gap-2 bg-[#0F172A] h-11 rounded-lg border border-border px-3">
									<Folder className="h-4 w-4 text-muted-foreground shrink-0" />
									<span className="flex-1 truncate text-sm font-mono text-foreground">
										{settings.savePath}
									</span>
								</div>
								<button
									type="button"
									onClick={handleChangeSavePath}
									disabled={changingPath}
									className="shrink-0 flex items-center gap-2 h-11 px-4 rounded-lg border border-border bg-[#0F172A] text-sm font-medium transition-colors hover:bg-[#0F172A]/80 disabled:opacity-50"
								>
									{changingPath ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<FolderOpen className="h-4 w-4" />
									)}
									変更
								</button>
							</div>

							{/* サブディレクトリの状態表示 */}
							{pathStatus?.valid && (
								<div className="flex gap-3 text-[11px]">
									<span className={`flex items-center gap-1 ${pathStatus.hasVideosDir ? "text-cyan" : "text-muted-foreground/50"}`}>
										<Check className="h-3 w-3" />
										videos/
									</span>
									<span className={`flex items-center gap-1 ${pathStatus.hasAudioDir ? "text-cyan" : "text-muted-foreground/50"}`}>
										<Check className="h-3 w-3" />
										audio/
									</span>
								</div>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<FieldLabel>DEFAULT FORMAT</FieldLabel>
							<div className="flex gap-2">
								{FORMAT_OPTIONS.map((f) => (
									<button
										key={f}
										type="button"
										onClick={() => updateField("defaultFormat", f)}
										className={`px-4 h-9 rounded-lg text-sm font-medium uppercase transition-colors ${
											settings.defaultFormat === f
												? "bg-cyan text-cyan-foreground"
												: "bg-[#0F172A] border border-border text-foreground hover:bg-[#0F172A]/80"
										}`}
									>
										{f}
									</button>
								))}
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<FieldLabel>DEFAULT QUALITY</FieldLabel>
							<div className="relative">
								<select
									value={settings.defaultQuality}
									onChange={(e) => updateField("defaultQuality", e.target.value)}
									className="w-full h-11 bg-[#0F172A] border border-border rounded-lg px-3 text-sm outline-none appearance-none focus:border-cyan/50"
								>
									<option value="2160p">2160p (4K)</option>
									<option value="1440p">1440p (QHD)</option>
									<option value="1080p">1080p (Full HD)</option>
									<option value="720p">720p (HD)</option>
									<option value="480p">480p (SD)</option>
								</select>
								<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
							</div>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-0.5">
								<span className="text-sm font-medium">
									Concurrent Downloads
								</span>
								<span className="text-xs text-muted-foreground">
									Maximum simultaneous downloads
								</span>
							</div>
							<input
								type="number"
								min={1}
								max={10}
								value={settings.concurrentDownloads}
								onChange={(e) => updateField("concurrentDownloads", Number(e.target.value))}
								className="w-20 h-9 bg-[#0F172A] border border-border rounded-lg text-center text-sm outline-none focus:border-cyan/50"
							/>
						</div>

						<div className="flex flex-col gap-2">
							<FieldLabel>BROWSER COOKIES</FieldLabel>
							<div className="flex flex-col gap-1.5">
								<div className="relative">
									<select
										value={settings.cookiesBrowser ?? ""}
										onChange={(e) =>
											updateField(
												"cookiesBrowser",
												e.target.value || null,
											)
										}
										className="w-full h-11 bg-[#0F172A] border border-border rounded-lg px-3 text-sm outline-none appearance-none focus:border-cyan/50"
									>
										{BROWSER_OPTIONS.map((opt) => (
											<option key={opt.value} value={opt.value}>
												{opt.label}
											</option>
										))}
									</select>
									<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
								</div>
								<span className="text-[11px] text-muted-foreground">
									YouTube authentication to bypass bot detection
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Right Column */}
				<div className="flex flex-col gap-6">
					{/* Notifications */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Bell} label="Notifications" />

						<ToggleRow
							label="Download Complete"
							description="Show notification when download finishes"
							checked={settings.notifComplete}
							onCheckedChange={(v) => updateField("notifComplete", v)}
						/>
						<ToggleRow
							label="Error Alerts"
							description="Show notification on download errors"
							checked={settings.notifError}
							onCheckedChange={(v) => updateField("notifError", v)}
						/>
						<ToggleRow
							label="Sound Effects"
							description="Play sound on download events"
							checked={settings.notifSound}
							onCheckedChange={(v) => updateField("notifSound", v)}
						/>
					</div>

					{/* About */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Info} label="About" />

						<InfoRow label="App Version" value="v2.0.0" />
						<InfoRow label="yt-dlp Version" value={ytDlpVersion} />
						<InfoRow label="Runtime" value="Tauri 2" />

						<div className="h-px bg-[#0F172A]" />

						<button
							type="button"
							onClick={handleUpdateYtDlp}
							disabled={updating}
							className="flex items-center justify-center gap-2 w-full h-10 bg-[#0F172A] border border-border rounded-lg text-sm hover:bg-[#0F172A]/80 transition-colors disabled:opacity-50"
						>
							{updating ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<RefreshCw className="h-4 w-4" />
							)}
							{updating ? "Updating yt-dlp..." : "Update yt-dlp"}
						</button>
					</div>

					{/* Danger Zone */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-4 border border-[#47556933]">
						<SectionHeader icon={TriangleAlert} label="Danger Zone" muted />

						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-0.5">
								<span className="text-sm font-medium">Clear Cache</span>
								<span className="text-xs text-muted-foreground">
									Remove all cached thumbnails and metadata
								</span>
							</div>
							<button
								type="button"
								className="px-3 h-8 bg-[#0F172A] border border-[#475569] rounded-md text-sm hover:bg-[#0F172A]/80 transition-colors"
							>
								Clear
							</button>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-0.5">
								<span className="text-sm font-medium">Reset All Settings</span>
								<span className="text-xs text-muted-foreground">
									Restore all settings to defaults
								</span>
							</div>
							<button
								type="button"
								className="px-3 h-8 bg-[#0F172A] border border-[#475569] rounded-md text-sm hover:bg-[#0F172A]/80 transition-colors"
							>
								Reset
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
