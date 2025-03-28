import { Download } from "lucide-react";

import { DialogSettingPath } from "@/components/DialogSettingPath";

interface AppHeaderProps {
	folderPath: string;
	setFolderPath: (path: string) => void;
	downloading: boolean;
}

export function AppHeader({
	folderPath,
	setFolderPath,
	downloading,
}: AppHeaderProps) {
	return (
		<header className="border-b bg-background/80 backdrop-saturate-150 border-border/40 backdrop-blur-sm sticky top-0 z-10">
			<div className="container mx-auto px-4 py-3 flex items-center justify-between">
				<h1 className="text-2xl font-bold flex items-center gap-2">
					<Download className="h-6 w-6" />
					<span>Lucentia</span>
				</h1>
				<DialogSettingPath
					initialPath={folderPath}
					onPathChange={setFolderPath}
					disabled={downloading}
				/>
			</div>
		</header>
	);
}
