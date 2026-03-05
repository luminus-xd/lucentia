"use client";

import { useRef, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { useTranslation } from "@/lib/i18n";

export type SortKey = "date" | "name" | "size";
export type SortDir = "asc" | "desc";

const SORT_KEYS: SortKey[] = ["date", "name", "size"];

export function SortDropdown({
	sortKey,
	sortDir,
	onSort,
}: {
	sortKey: SortKey;
	sortDir: SortDir;
	onSort: (key: SortKey, dir: SortDir) => void;
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useClickOutside(ref, () => setOpen(false));

	const sortLabels: Record<SortKey, string> = {
		date: t("downloads.date"),
		name: t("downloads.name"),
		size: t("downloads.size"),
	};

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-2 bg-secondary rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-secondary/80 transition-colors"
			>
				<ArrowUpDown className="h-4 w-4" />
				{sortLabels[sortKey]}
			</button>
			{open && (
				<div className="absolute right-0 top-full mt-1 w-48 bg-secondary border border-border rounded-lg p-1 shadow-lg z-50">
					{SORT_KEYS.map((key) => (
						<button
							type="button"
							key={key}
							onClick={() => {
								if (sortKey === key) {
									onSort(key, sortDir === "asc" ? "desc" : "asc");
								} else {
									onSort(key, key === "name" ? "asc" : "desc");
								}
								setOpen(false);
							}}
							className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-sm transition-colors ${
								sortKey === key
									? "bg-background text-cyan"
									: "text-foreground hover:bg-background/50"
							}`}
						>
							{sortLabels[key]}
							{sortKey === key && (
								<span className="text-[10px] font-mono text-muted-foreground">
									{sortDir === "asc" ? "ASC" : "DESC"}
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
