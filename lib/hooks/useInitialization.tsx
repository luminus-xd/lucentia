"use client";

import { invoke } from "@tauri-apps/api/core";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";

type InitState = "loading" | "needs-setup" | "ready";

interface InitializationContextValue {
	state: InitState;
	initialize: (savePath: string) => Promise<void>;
}

const InitializationContext = createContext<InitializationContextValue | null>(
	null,
);

export function InitializationProvider({
	children,
}: { children: ReactNode }) {
	const [state, setState] = useState<InitState>("loading");

	useEffect(() => {
		invoke<boolean>("is_initialized")
			.then((initialized) => {
				setState(initialized ? "ready" : "needs-setup");
			})
			.catch(() => {
				setState("needs-setup");
			});
	}, []);

	const initialize = useCallback(async (savePath: string) => {
		await invoke("initialize_app", { savePath });
		setState("ready");
	}, []);

	return (
		<InitializationContext value={{ state, initialize }}>
			{children}
		</InitializationContext>
	);
}

export function useInitialization() {
	const ctx = useContext(InitializationContext);
	if (!ctx) {
		throw new Error(
			"useInitialization must be used within InitializationProvider",
		);
	}
	return ctx;
}
