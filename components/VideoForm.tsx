import { Download, LoaderCircle, Music, Video, Clock } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { VideoMetadata } from "@/lib/hooks/useVideoDownloader";

interface VideoFormProps {
	url: string;
	setUrl: (url: string) => void;
	audioOnly: boolean;
	setAudioOnly: (value: boolean) => void;
	bestQuality: boolean;
	setBestQuality: (value: boolean) => void;
	downloadSubtitles: boolean;
	setDownloadSubtitles: (value: boolean) => void;
	preferredFormat: string;
	setPreferredFormat: (format: string) => void;
	metadata: VideoMetadata | null;
	status: string;
	downloading: boolean;
	progress: number;
	handleDownload: () => Promise<void>;
}

export function VideoForm({
	url,
	setUrl,
	audioOnly,
	setAudioOnly,
	bestQuality,
	setBestQuality,
	downloadSubtitles,
	setDownloadSubtitles,
	preferredFormat,
	setPreferredFormat,
	metadata,
	status,
	downloading,
	progress,
	handleDownload,
}: VideoFormProps) {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Label htmlFor="url" className="text-sm font-medium">
					動画URL
				</Label>
				<div className="relative">
					<Input
						id="url"
						type="text"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://www.youtube.com/watch?v=..."
						disabled={downloading}
						className="input-dark pl-10"
					/>
					<div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
						<Video className="h-4 w-4" />
					</div>
				</div>
			</div>

			<div className="space-y-4">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					<div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/10">
						<div className="flex items-center gap-2">
							<Music className="h-4 w-4" />
							<Label htmlFor="audioOnly" className="text-sm font-medium">
								音声のみ
							</Label>
						</div>
						<Switch
							id="audioOnly"
							checked={audioOnly}
							onCheckedChange={setAudioOnly}
							disabled={downloading}
						/>
					</div>

					<div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/10">
						<div className="flex items-center gap-2">
							<Video className="h-4 w-4" />
							<Label htmlFor="bestQuality" className="text-sm font-medium">
								最高品質
							</Label>
						</div>
						<Switch
							id="bestQuality"
							checked={bestQuality}
							onCheckedChange={setBestQuality}
							disabled={downloading || audioOnly}
						/>
					</div>

					<div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/10">
						<Label htmlFor="downloadSubtitles" className="text-sm font-medium">
							字幕をダウンロード
						</Label>
						<Switch
							id="downloadSubtitles"
							checked={downloadSubtitles}
							onCheckedChange={setDownloadSubtitles}
							disabled={downloading || audioOnly}
						/>
					</div>
				</div>

				{!audioOnly && (
					<div className="p-3 rounded-lg border border-border/40 bg-muted/10">
						<Label className="text-sm font-medium mb-2 block">
							フォーマット
						</Label>
						<Select
							value={preferredFormat}
							onValueChange={setPreferredFormat}
							disabled={downloading}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="フォーマットを選択" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="mp4">MP4</SelectItem>
								<SelectItem value="mkv">MKV</SelectItem>
								<SelectItem value="webm">WebM</SelectItem>
							</SelectContent>
						</Select>
					</div>
				)}
			</div>

			<div>
				<Button
					onClick={handleDownload}
					disabled={downloading || !url}
					className="w-full"
					size="lg"
				>
					{downloading ? (
						<div className="flex items-center gap-2">
							<LoaderCircle className="animate-spin h-5 w-5" />
							ダウンロード中...
						</div>
					) : (
						<div className="flex items-center gap-2">
							<Download className="h-5 w-5" />
							ダウンロード開始
						</div>
					)}
				</Button>
			</div>

			{downloading && (
				<div className="space-y-1">
					<Progress value={progress} className="h-2" />
					<p className="text-xs text-right text-muted-foreground">
						{Math.round(progress)}%
					</p>
				</div>
			)}

			{metadata && (
				<Card className="overflow-hidden border border-border/50 bg-background/50 backdrop-blur-sm">
					<div className="relative aspect-video w-full overflow-hidden">
						{metadata.thumbnail ? (
							<Image
								src={metadata.thumbnail}
								alt={metadata.title}
								fill
								className="object-cover transition-transform hover:scale-105 duration-500"
							/>
						) : (
							<div className="flex items-center justify-center w-full h-full bg-muted/50">
								<Video className="h-12 w-12 text-muted-foreground/50" />
							</div>
						)}
						{metadata.duration && (
							<Badge
								variant="secondary"
								className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white"
							>
								<Clock className="h-3 w-3" />
								{metadata.duration}
							</Badge>
						)}
					</div>
					<CardContent className="p-3">
						<h3 className="font-medium line-clamp-2 text-sm">
							{metadata.title}
						</h3>
					</CardContent>
				</Card>
			)}

			{status && (
				<div className="text-sm text-muted-foreground">
					<p>{status}</p>
				</div>
			)}
		</div>
	);
}
