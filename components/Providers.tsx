"use client";

import { InitializationProvider } from "@/lib/hooks/useInitialization";

export function Providers({ children }: { children: React.ReactNode }) {
	return <InitializationProvider>{children}</InitializationProvider>;
}
