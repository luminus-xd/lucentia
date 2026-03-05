"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	Terminal,
	Download,
	Bell,
	Info,
	TriangleAlert,
	Save,
	Folder,
	ChevronDown,
	RefreshCw,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

const FORMAT_OPTIONS = ["mp4", "mkv", "mp3", "webm"] as const;
type Format = (typeof FORMAT_OPTIONS)[number];

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
	const [ffmpegPath, setFfmpegPath] = useState("/opt/homebrew/bin/ffmpeg");
	const [hwAccel, setHwAccel] = useState(true);
	const [threadCount, setThreadCount] = useState(4);
	const [savePath, setSavePath] = useState("~/Downloads/Lucentia");
	const [format, setFormat] = useState<Format>("mp4");
	const [quality, setQuality] = useState("1080p");
	const [concurrent, setConcurrent] = useState(3);
	const [notifComplete, setNotifComplete] = useState(true);
	const [notifError, setNotifError] = useState(true);
	const [notifSound, setNotifSound] = useState(false);

	const handleSave = () => {
		toast.success("Settings saved");
	};

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
					{/* ffmpeg Configuration */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Terminal} label="ffmpeg Configuration" />

						<div className="flex flex-col gap-2">
							<FieldLabel>FFMPEG PATH</FieldLabel>
							<div className="flex gap-2">
								<div className="flex-1 flex items-center gap-2 bg-[#0F172A] h-11 rounded-lg border border-border px-3">
									<Folder className="h-4 w-4 text-muted-foreground shrink-0" />
									<input
										type="text"
										value={ffmpegPath}
										onChange={(e) => setFfmpegPath(e.target.value)}
										className="flex-1 bg-transparent text-sm outline-none"
									/>
								</div>
								<button
									type="button"
									className="px-3 h-11 bg-[#0F172A] border border-[#475569] rounded-md text-sm hover:bg-[#0F172A]/80 transition-colors"
								>
									Browse
								</button>
							</div>
						</div>

						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">
								Detected Version
							</span>
							<span className="inline-flex items-center gap-1.5 rounded-full bg-cyan/15 px-2.5 py-1 text-xs font-medium text-cyan">
								<span className="h-1.5 w-1.5 rounded-full bg-cyan" />
								v7.1.0
							</span>
						</div>

						<ToggleRow
							label="Hardware Acceleration"
							description="Use GPU for faster encoding when available"
							checked={hwAccel}
							onCheckedChange={setHwAccel}
						/>

						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-0.5">
								<span className="text-sm font-medium">Thread Count</span>
								<span className="text-xs text-muted-foreground">
									Number of threads for encoding
								</span>
							</div>
							<input
								type="number"
								min={1}
								max={32}
								value={threadCount}
								onChange={(e) => setThreadCount(Number(e.target.value))}
								className="w-20 h-9 bg-[#0F172A] border border-border rounded-lg text-center text-sm outline-none focus:border-cyan/50"
							/>
						</div>
					</div>

					{/* Download Settings */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Download} label="Download Settings" />

						<div className="flex flex-col gap-2">
							<FieldLabel>SAVE LOCATION</FieldLabel>
							<div className="flex items-center gap-2 bg-[#0F172A] h-11 rounded-lg border border-border px-3">
								<Folder className="h-4 w-4 text-muted-foreground shrink-0" />
								<input
									type="text"
									value={savePath}
									onChange={(e) => setSavePath(e.target.value)}
									className="flex-1 bg-transparent text-sm outline-none"
								/>
							</div>
						</div>

						<div className="flex flex-col gap-2">
							<FieldLabel>DEFAULT FORMAT</FieldLabel>
							<div className="flex gap-2">
								{FORMAT_OPTIONS.map((f) => (
									<button
										key={f}
										type="button"
										onClick={() => setFormat(f)}
										className={`px-4 h-9 rounded-lg text-sm font-medium uppercase transition-colors ${
											format === f
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
									value={quality}
									onChange={(e) => setQuality(e.target.value)}
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
								value={concurrent}
								onChange={(e) => setConcurrent(Number(e.target.value))}
								className="w-20 h-9 bg-[#0F172A] border border-border rounded-lg text-center text-sm outline-none focus:border-cyan/50"
							/>
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
							checked={notifComplete}
							onCheckedChange={setNotifComplete}
						/>
						<ToggleRow
							label="Error Alerts"
							description="Show notification on download errors"
							checked={notifError}
							onCheckedChange={setNotifError}
						/>
						<ToggleRow
							label="Sound Effects"
							description="Play sound on download events"
							checked={notifSound}
							onCheckedChange={setNotifSound}
						/>
					</div>

					{/* About */}
					<div className="bg-card rounded-xl p-6 flex flex-col gap-5">
						<SectionHeader icon={Info} label="About" />

						<InfoRow label="App Version" value="v2.4.1" />
						<InfoRow label="ffmpeg Version" value="v7.1.0" />
						<InfoRow label="Runtime" value="Tauri" />

						<div className="h-px bg-[#0F172A]" />

						<button
							type="button"
							className="flex items-center justify-center gap-2 w-full h-10 bg-[#0F172A] border border-border rounded-lg text-sm hover:bg-[#0F172A]/80 transition-colors"
						>
							<RefreshCw className="h-4 w-4" />
							Check for Updates
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
