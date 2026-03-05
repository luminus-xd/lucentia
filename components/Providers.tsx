"use client";

import { I18nProvider } from "@/lib/i18n";
import { InitializationProvider } from "@/lib/hooks/useInitialization";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<I18nProvider>
			<InitializationProvider>{children}</InitializationProvider>
		</I18nProvider>
	);
}
