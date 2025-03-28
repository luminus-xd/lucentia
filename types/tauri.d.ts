declare module "@tauri-apps/plugin-dialog" {
	interface OpenDialogOptions {
		/** 複数選択を許可するかどうか */
		multiple?: boolean;
		/** ディレクトリを選択するかどうか */
		directory?: boolean;
		/** ダイアログのタイトル */
		title?: string;
		/** デフォルトのパス */
		defaultPath?: string;
		/** フィルター（例：[{name: 'Image', extensions: ['png', 'jpeg']}]） */
		filters?: {
			name: string;
			extensions: string[];
		}[];
	}

	/**
	 * ファイル・フォルダ選択ダイアログを開く
	 * @param options ダイアログオプション
	 * @returns 選択されたパス（複数選択の場合は配列、選択がキャンセルされた場合はnull）
	 */
	export function open(
		options?: OpenDialogOptions,
	): Promise<string | string[] | null>;

	/**
	 * ファイル保存ダイアログを開く
	 * @param options ダイアログオプション
	 * @returns 選択されたパス（選択がキャンセルされた場合はnull）
	 */
	export function save(
		options?: Omit<OpenDialogOptions, "multiple" | "directory">,
	): Promise<string | null>;
}
