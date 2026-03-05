import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** サポートする動画フォーマットと表示ラベルのマッピング */
export const VIDEO_FORMAT_OPTIONS = {
	mp4: "MP4",
	mkv: "MKV",
	webm: "WebM",
} as const;

/** サポートする音声フォーマットと表示ラベルのマッピング */
export const AUDIO_FORMAT_OPTIONS = {
	mp3: "MP3",
	m4a: "M4A",
} as const;

/** 全フォーマット（後方互換） */
export const FORMAT_OPTIONS = {
	...VIDEO_FORMAT_OPTIONS,
	...AUDIO_FORMAT_OPTIONS,
} as const;

export type VideoFormat = keyof typeof VIDEO_FORMAT_OPTIONS;
export type AudioFormat = keyof typeof AUDIO_FORMAT_OPTIONS;

/** 音声フォーマットかどうかを判定 */
export function isAudioFormat(format: string): boolean {
	return format in AUDIO_FORMAT_OPTIONS;
}

/** フォーマットキーから表示ラベルを取得 */
export function getFormatLabel(format: string): string {
	return FORMAT_OPTIONS[format as keyof typeof FORMAT_OPTIONS] ?? "MP4";
}

/** Set の要素をトグルする（あれば削除、なければ追加） */
export function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
	const next = new Set(set);
	if (next.has(item)) {
		next.delete(item);
	} else {
		next.add(item);
	}
	return next;
}
