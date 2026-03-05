import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification";
import type { AppSettings } from "./hooks/useSettings";

/** 通知の権限を確認し、未許可なら許可をリクエストする */
export async function ensureNotificationPermission(): Promise<boolean> {
	let granted = await isPermissionGranted();
	if (!granted) {
		const permission = await requestPermission();
		granted = permission === "granted";
	}
	return granted;
}

/**
 * AudioContext のシングルトン管理
 * WebView の autoplay policy により、ユーザージェスチャーのコールスタック上で
 * AudioContext を作成・resume する必要がある
 */
let audioCtx: AudioContext | null = null;

/**
 * ユーザー操作（ボタンクリック等）のタイミングで呼び出し、
 * AudioContext を初期化・resume しておく
 */
export function warmUpAudioContext(): void {
	if (!audioCtx) {
		audioCtx = new AudioContext();
	}
	if (audioCtx.state === "suspended") {
		audioCtx.resume();
	}
}

type NotifyType = "success" | "error";

/** 通知送信の共通処理 */
async function sendAppNotification(
	settings: AppSettings | undefined,
	enabledKey: "notifComplete" | "notifError",
	title: string,
	body: string,
	soundType: NotifyType,
): Promise<void> {
	if (!settings?.[enabledKey]) return;

	const granted = await isPermissionGranted();
	if (!granted) return;

	sendNotification({ title, body });

	if (settings.notifSound) {
		playNotificationSound(soundType);
	}
}

/** ダウンロード完了時にOS通知を送信する */
export function notifyDownloadComplete(
	settings: AppSettings | undefined,
	notificationTitle: string,
	title: string | undefined,
	outputPath: string,
): Promise<void> {
	return sendAppNotification(
		settings,
		"notifComplete",
		notificationTitle,
		title || outputPath,
		"success",
	);
}

/** ダウンロードエラー時にOS通知を送信する */
export function notifyDownloadError(
	settings: AppSettings | undefined,
	notificationTitle: string,
	errorMessage: string,
): Promise<void> {
	return sendAppNotification(
		settings,
		"notifError",
		notificationTitle,
		errorMessage,
		"error",
	);
}

/** Web Audio API でトーン音を生成して再生する */
function playNotificationSound(type: NotifyType): void {
	warmUpAudioContext();
	if (!audioCtx) return;

	if (type === "success") {
		// 成功: ふわっとした2音（A5 → E6）— 高めの柔らかいベル風
		playSoftTone(audioCtx, 880, 0, 0.35);
		playSoftTone(audioCtx, 1318.5, 0.18, 0.4);
	} else {
		// エラー: やさしい下降2音（E5 → B4）
		playSoftTone(audioCtx, 659.25, 0, 0.3);
		playSoftTone(audioCtx, 493.88, 0.2, 0.35);
	}
}

/** やわらかいベル風のトーンを再生する */
function playSoftTone(
	ctx: AudioContext,
	frequency: number,
	startTime: number,
	duration: number,
): void {
	const now = ctx.currentTime + startTime;

	// メインの sine 波（やわらかい基音）
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(frequency, now);

	// ゆるやかなビブラートで揺らぎを加える
	const vibrato = ctx.createOscillator();
	const vibratoGain = ctx.createGain();
	vibrato.frequency.value = 5;
	vibratoGain.gain.value = frequency * 0.008;
	vibrato.connect(vibratoGain);
	vibratoGain.connect(osc.frequency);

	// ふわっと立ち上がり、ゆっくりフェードアウト
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0, now);
	gain.gain.linearRampToValueAtTime(0.15, now + 0.06);
	gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

	osc.connect(gain);
	gain.connect(ctx.destination);

	osc.start(now);
	osc.stop(now + duration);
	vibrato.start(now);
	vibrato.stop(now + duration);
}
