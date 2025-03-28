import { useState, useEffect } from "react";
import { FolderOpen, Save } from "lucide-react";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { open } from "@tauri-apps/plugin-dialog";

interface DialogSettingPathProps {
	initialPath: string;
	onPathChange: (newPath: string) => void;
	disabled?: boolean;
}

export function DialogSettingPath({
	initialPath,
	onPathChange,
	disabled = false,
}: DialogSettingPathProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [tempPath, setTempPath] = useState(initialPath);

	useEffect(() => {
		setTempPath(initialPath);
	}, [initialPath]);

	const handleSave = () => {
		onPathChange(tempPath);
		setDialogOpen(false);
	};

	const handleSelectFolder = async () => {
		try {
			// フォルダ選択ダイアログを開く
			const selected = await open({
				directory: true,
				multiple: false,
				title: "保存先フォルダを選択",
			});

			// 選択がある場合、パスを更新
			if (selected && typeof selected === "string") {
				setTempPath(selected);
			}
		} catch (error) {
			console.error("フォルダ選択エラー:", error);
		}
	};

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={disabled}
					className="flex items-center gap-1.5 text-sm"
				>
					<FolderOpen className="h-4 w-4" />
					保存先設定
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md glass-panel">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FolderOpen className="h-5 w-5" />
						出力ディレクトリ設定
					</DialogTitle>
					<DialogDescription className="text-muted-foreground text-sm">
						ダウンロードしたファイルを保存するディレクトリを設定します。設定しない場合は、OS
						のダウンロードフォルダが利用されます。
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-center space-x-2 mt-2">
					<div className="grid flex-1 gap-2">
						<Label htmlFor="path" className="text-xs font-medium">
							保存先パス
						</Label>
						<div className="flex items-center gap-2">
							<Input
								id="path"
								value={tempPath}
								onChange={(e) => setTempPath(e.target.value)}
								placeholder="/Users/user/Downloads"
								className="input-dark flex-1"
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleSelectFolder}
								title="フォルダを参照"
							>
								<FolderOpen className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
				<DialogFooter className="mt-4 flex justify-between">
					<DialogClose asChild>
						<Button type="button" variant="outline" size="sm">
							キャンセル
						</Button>
					</DialogClose>
					<Button
						onClick={handleSave}
						type="button"
						size="sm"
						className="gap-1.5"
					>
						<Save className="h-4 w-4" />
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
