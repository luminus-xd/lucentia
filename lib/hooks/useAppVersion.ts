import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

/** アプリバージョンを取得するフック */
export function useAppVersion(): string {
	const [version, setVersion] = useState("");

	useEffect(() => {
		getVersion()
			.then(setVersion)
			.catch(() => setVersion("unknown"));
	}, []);

	return version;
}
