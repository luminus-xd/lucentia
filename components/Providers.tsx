"use client";

import { I18nProvider } from "@/lib/i18n";
import { InitializationProvider } from "@/lib/hooks/useInitialization";
import { DownloadQueueProvider } from "@/lib/hooks/useDownloadQueue";
import { useSettings } from "@/lib/hooks/useSettings";

function InnerProviders({ children }: { children: React.ReactNode }) {
	const { settings } = useSettings();
	return (
		<DownloadQueueProvider settings={settings}>
			{children}
		</DownloadQueueProvider>
	);
}

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<I18nProvider>
			<InitializationProvider>
				<InnerProviders>{children}</InnerProviders>
			</InitializationProvider>
		</I18nProvider>
	);
}
