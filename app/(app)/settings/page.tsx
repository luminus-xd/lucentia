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
	Globe,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAppVersion } from "@/lib/hooks/useAppVersion";
import { useSettings } from "@/lib/hooks/useSettings";
import { FORMAT_OPTIONS } from "@/lib/utils";
import { useTranslation, type Locale } from "@/lib/i18n";

const BROWSER_OPTIONS = [
	{ value: "", label: "None (disabled)" },
	{ value: "chrome", label: "Chrome" },
	{ value: "firefox", label: "Firefox" },
	{ value: "safari", label: "Safari" },
	{ value: "edge", label: "Edge" },
	{ value: "brave", label: "Brave" },
] as const;

type SectionHeaderVariant = "default" | "muted";

const sectionHeaderStyles: Record<SectionHeaderVariant, { icon: string; heading: string }> = {
	default: { icon: "text-cyan", heading: "" },
	muted: { icon: "text-muted-foreground", heading: "text-muted-foreground" },
};

function SectionHeader({
	icon: Icon,
	label,
	variant = "default",
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	variant?: SectionHeaderVariant;
}) {
	const styles = sectionHeaderStyles[variant];
	return (
		<div className="flex items-center gap-2.5">
			<Icon className={`h-5 w-5 ${styles.icon}`} />
			<h2 className={`text-base font-semibold ${styles.heading}`}>
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
	const { locale, setLocale, t } = useTranslation();
	const { settings, pathStatus, loading, hasChanges, saveSettings, updateField, changeSavePath, resetSettings } = useSettings();
	const appVersion = useAppVersion();
	const [ytDlpVersion, setYtDlpVersion] = useState<string>("...");
	const [updating, setUpdating] = useState(false);
	const [changingPath, setChangingPath] = useState(false);

	const browserLabel = (value: string, label: string) =>
		value === "" ? t("settings.browserNone") : label;

	const qualityLabels: Record<string, string> = {
		"2160p": t("settings.q2160"),
		"1440p": t("settings.q1440"),
		"1080p": t("settings.q1080"),
		"720p": t("settings.q720"),
		"480p": t("settings.q480"),
	};

	useEffect(() => {
		invoke<string>("get_yt_dlp_version").then(setYtDlpVersion).catch(() => setYtDlpVersion("not found"));
	}, []);

	const handleSave = async () => {
		await saveSettings(settings);
		toast.success(t("toast.settingsSaved"));
	};

	const handleChangeSavePath = useCallback(async () => {
		const selected = await open({ directory: true, multiple: false });
		if (!selected) return;

		const newPath = `${selected}/Lucentia`;
		setChangingPath(true);
		try {
			await changeSavePath(newPath);
			toast.success(t("toast.savePathChanged"), { description: newPath });
		} catch (e) {
			toast.error(t("toast.savePathError", { error: String(e) }));
		} finally {
			setChangingPath(false);
		}
	}, [changeSavePath, t]);

	const handleClearCache = useCallback(async () => {
		try {
			await invoke("clear_cache");
			toast.success(t("toast.cacheCleared"));
		} catch (e) {
			toast.error(t("toast.cacheClearError", { error: String(e) }));
		}
	}, [t]);

	const handleResetSettings = useCallback(async () => {
		try {
			await resetSettings();
			toast.success(t("toast.settingsReset"));
		} catch (e) {
			toast.error(t("toast.settingsResetError", { error: String(e) }));
		}
	}, [resetSettings, t]);

	const handleUpdateYtDlp = useCallback(async () => {
		setUpdating(true);
		try {
			const version = await invoke<string>("update_yt_dlp");
			setYtDlpVersion(version);
			toast.success(t("toast.ytDlpUpdated", { version }));
		} catch (e) {
			toast.error(t("toast.ytDlpUpdateError", { error: String(e) }));
		} finally {
			setUpdating(false);
		}
	}, [t]);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-muted-foreground">{t("settings.loading")}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-7 p-8 px-10">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-[28px] font-semibold">{t("settings.title")}</h1>
					<p className="text-sm text-muted-foreground">
						{t("settings.description")}
					</p>
				</div>
				<button
					type="button"
					onClick={handleSave}
					disabled={!hasChanges}
					className="flex items-center gap-2 rounded-lg bg-cyan px-5 h-10 text-sm font-semibold text-cyan-foreground transition-colors enabled:hover:bg-cyan/90 disabled:opacity-40 disabled:cursor-not-allowed"
				>
					<Save className="h-4 w-4" />
					{t("settings.saveChanges")}
				</button>
			</div>

			{/* Settings Grid */}
			<div className="grid grid-cols-2 gap-6 flex-1">
				{/* Left Column */}
				<div className="flex flex-col gap-6">
					{/* Download Settings */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Download} label={t("settings.downloadSettings")} />

						<div className="flex flex-col gap-2">
							<FieldLabel>{t("settings.saveLocation")}</FieldLabel>

							{/* パスが無効な場合の警告バナー */}
							{pathStatus && !pathStatus.valid && (
								<div className="flex items-center gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
									<AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
									<div className="flex flex-col gap-0.5">
										<span className="text-xs font-medium text-red-400">
											{t("settings.pathNotFound")}
										</span>
										<span className="text-[11px] text-red-400/70">
											{t("settings.pathNotFoundDesc")}
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
									{t("settings.change")}
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
							<FieldLabel>{t("settings.defaultFormat")}</FieldLabel>
							<div className="flex gap-2">
								{Object.entries(FORMAT_OPTIONS).map(([key, label]) => (
									<button
										key={key}
										type="button"
										onClick={() => updateField("defaultFormat", key)}
										className={`px-4 h-9 rounded-lg text-sm font-medium uppercase transition-colors ${
											settings.defaultFormat === key
												? "bg-cyan text-cyan-foreground"
												: "bg-[#0F172A] border border-border text-foreground hover:bg-[#0F172A]/80"
										}`}
									>
										{label}
									</button>
								))}
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<FieldLabel>{t("settings.defaultQuality")}</FieldLabel>
							<div className="relative">
								<select
									value={settings.defaultQuality}
									onChange={(e) => updateField("defaultQuality", e.target.value)}
									className="w-full h-11 bg-[#0F172A] border border-border rounded-lg px-3 text-sm outline-none appearance-none focus:border-cyan/50"
								>
									<option value="2160p">{qualityLabels["2160p"]}</option>
									<option value="1440p">{qualityLabels["1440p"]}</option>
									<option value="1080p">{qualityLabels["1080p"]}</option>
									<option value="720p">{qualityLabels["720p"]}</option>
									<option value="480p">{qualityLabels["480p"]}</option>
								</select>
								<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
							</div>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-0.5">
								<span className="text-sm font-medium">
									{t("settings.concurrent")}
								</span>
								<span className="text-xs text-muted-foreground">
									{t("settings.concurrentDesc")}
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
							<FieldLabel>{t("settings.browserCookies")}</FieldLabel>
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
												{browserLabel(opt.value, opt.label)}
											</option>
										))}
									</select>
									<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
								</div>
								<span className="text-[11px] text-muted-foreground">
									{t("settings.browserCookiesDesc")}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Right Column */}
				<div className="flex flex-col gap-6">
					{/* Language */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Globe} label={t("settings.languageSection")} />
						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-0.5">
								<span className="text-sm font-medium">
									{t("settings.languageSection")}
								</span>
								<span className="text-xs text-muted-foreground">
									{t("settings.languageDesc")}
								</span>
							</div>
							<div className="flex rounded-lg border border-border overflow-hidden">
								<button
									type="button"
									onClick={() => setLocale("ja")}
									className={`px-4 py-2 text-sm font-medium transition-colors ${
										locale === "ja"
											? "bg-cyan text-cyan-foreground"
											: "bg-[#0F172A] text-foreground hover:bg-[#0F172A]/80"
									}`}
								>
									日本語
								</button>
								<button
									type="button"
									onClick={() => setLocale("en")}
									className={`px-4 py-2 text-sm font-medium transition-colors ${
										locale === "en"
											? "bg-cyan text-cyan-foreground"
											: "bg-[#0F172A] text-foreground hover:bg-[#0F172A]/80"
									}`}
								>
									English
								</button>
							</div>
						</div>
					</div>

					{/* Notifications */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Bell} label={t("settings.notifications")} />

						<ToggleRow
							label={t("settings.notifComplete")}
							description={t("settings.notifCompleteDesc")}
							checked={settings.notifComplete}
							onCheckedChange={(v) => updateField("notifComplete", v)}
						/>
						<ToggleRow
							label={t("settings.notifError")}
							description={t("settings.notifErrorDesc")}
							checked={settings.notifError}
							onCheckedChange={(v) => updateField("notifError", v)}
						/>
						<ToggleRow
							label={t("settings.notifSound")}
							description={t("settings.notifSoundDesc")}
							checked={settings.notifSound}
							onCheckedChange={(v) => updateField("notifSound", v)}
						/>
					</div>

					{/* About */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Info} label={t("settings.about")} />

						<InfoRow label={t("settings.appVersion")} value={appVersion ? `v${appVersion}` : "..."} />
						<InfoRow label={t("settings.ytDlpVersion")} value={ytDlpVersion} />
						<InfoRow label={t("settings.runtime")} value="Tauri 2" />

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
							{updating ? t("settings.updatingYtDlp") : t("settings.updateYtDlp")}
						</button>
					</div>

					{/* Danger Zone */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-4 border border-[#47556933]">
						<SectionHeader icon={TriangleAlert} label={t("settings.dangerZone")} variant="muted" />

						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-0.5">
								<span className="text-sm font-medium">{t("settings.clearCache")}</span>
								<span className="text-xs text-muted-foreground">
									{t("settings.clearCacheDesc")}
								</span>
							</div>
							<button
								type="button"
								onClick={handleClearCache}
								className="px-3 h-8 bg-[#0F172A] border border-[#475569] rounded-md text-sm hover:bg-[#0F172A]/80 transition-colors"
							>
								{t("settings.clearBtn")}
							</button>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-0.5">
								<span className="text-sm font-medium">{t("settings.resetSettings")}</span>
								<span className="text-xs text-muted-foreground">
									{t("settings.resetSettingsDesc")}
								</span>
							</div>
							<button
								type="button"
								onClick={handleResetSettings}
								className="px-3 h-8 bg-[#0F172A] border border-[#475569] rounded-md text-sm hover:bg-[#0F172A]/80 transition-colors"
							>
								{t("settings.resetBtn")}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
