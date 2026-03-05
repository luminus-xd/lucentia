import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** サポートするフォーマットと表示ラベルのマッピング */
export const FORMAT_OPTIONS = {
	mp4: "MP4",
	mkv: "MKV",
	webm: "WebM",
} as const;

export type VideoFormat = keyof typeof FORMAT_OPTIONS;

/** フォーマットキーから表示ラベルを取得 */
export function getFormatLabel(format: string): string {
	return FORMAT_OPTIONS[format as VideoFormat] ?? "MP4";
}
