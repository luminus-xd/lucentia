"use client";

import { useRef, useState } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { useTranslation } from "@/lib/i18n";
import { toggleSetItem } from "@/lib/utils";

export function FilterDropdown({
	formats,
	selected,
	onChangeSelected,
}: {
	formats: string[];
	selected: Set<string>;
	onChangeSelected: (next: Set<string>) => void;
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, () => setOpen(false));

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className={`flex items-center gap-2 bg-secondary rounded-lg py-3 px-4 text-sm transition-colors ${
					selected.size > 0
						? "text-cyan"
						: "text-slate-400 hover:bg-secondary/80"
				}`}
			>
				<SlidersHorizontal className="h-4 w-4" />
				{t("downloads.filter")}
				{selected.size > 0 && (
					<span className="bg-cyan text-cyan-foreground text-[10px] font-bold font-mono rounded px-1.5 py-0.5 leading-none">
						{selected.size}
					</span>
				)}
			</button>
			{open && (
				<div className="absolute right-0 top-full mt-1 w-48 bg-secondary border border-border rounded-lg p-1 shadow-lg z-50">
					{formats.length === 0 ? (
						<p className="px-3 py-2 text-xs text-muted-foreground">
							{t("downloads.noFormats")}
						</p>
					) : (
						<>
							{formats.map((fmt) => (
								<button
									type="button"
									key={fmt}
									onClick={() =>
										onChangeSelected(toggleSetItem(selected, fmt))
									}
									className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors hover:bg-background/50"
								>
									<div
										className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
											selected.has(fmt)
												? "bg-cyan border-cyan"
												: "border-slate-600"
										}`}
									>
										{selected.has(fmt) && (
											<Check className="h-3 w-3 text-cyan-foreground" />
										)}
									</div>
									<span className="font-mono text-xs">{fmt}</span>
								</button>
							))}
							{selected.size > 0 && (
								<>
									<div className="h-px bg-background my-1" />
									<button
										type="button"
										onClick={() => onChangeSelected(new Set())}
										className="w-full rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-background/50 transition-colors"
									>
										{t("downloads.clearAll")}
									</button>
								</>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
