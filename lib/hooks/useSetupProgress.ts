import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type StepStatus = "pending" | "in_progress" | "ready" | "error";

interface SetupProgressPayload {
	step: "yt-dlp" | "ffmpeg" | "deno";
	status: StepStatus;
}

interface SetupSteps {
	"yt-dlp": StepStatus;
	ffmpeg: StepStatus;
	deno: StepStatus;
}

/** バイナリセットアップの進捗を追跡するフック */
export function useSetupProgress() {
	const [steps, setSteps] = useState<SetupSteps>({
		"yt-dlp": "pending",
		ffmpeg: "pending",
		deno: "pending",
	});
	const [isComplete, setIsComplete] = useState<boolean | null>(null);

	useEffect(() => {
		let cancelled = false;
		const unlisteners: Promise<UnlistenFn>[] = [];

		async function init() {
			// リスナーを先に登録してイベント見逃しを防ぐ
			unlisteners.push(
				listen<SetupProgressPayload>("setup-progress", (event) => {
					if (cancelled) return;
					const { step, status } = event.payload;
					setSteps((prev) => ({ ...prev, [step]: status }));
				}),
			);

			unlisteners.push(
				listen("setup-complete", () => {
					if (cancelled) return;
					setIsComplete(true);
				}),
			);

			// リスナー登録後に現在の状態を確認（見逃し防止）
			const complete = await invoke<boolean>("is_setup_complete");
			if (cancelled) return;

			if (complete) {
				setSteps({ "yt-dlp": "ready", ffmpeg: "ready", deno: "ready" });
				setIsComplete(true);
			} else {
				setIsComplete(false);
			}
		}

		init();

		return () => {
			cancelled = true;
			for (const unlisten of unlisteners) {
				unlisten.then((fn) => fn());
			}
		};
	}, []);

	return { steps, isComplete: isComplete ?? true };
}
