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
