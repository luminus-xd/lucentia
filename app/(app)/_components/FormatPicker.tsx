"use client";

import { useTranslation } from "@/lib/i18n";
import { VIDEO_FORMAT_OPTIONS, AUDIO_FORMAT_OPTIONS } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";

type Group = "video" | "audio";

interface FormatOption {
	value: string;
	label: string;
	group: Group;
}

const ALL_OPTIONS: FormatOption[] = [
	...Object.entries(VIDEO_FORMAT_OPTIONS).map(([value, label]) => ({
		value,
		label: `${label} 1080p`,
		group: "video" as const,
	})),
	...Object.entries(AUDIO_FORMAT_OPTIONS).map(([value, label]) => ({
		value,
		label,
		group: "audio" as const,
	})),
];

const GROUP_CONFIG: { key: Group; labelKey: "downloads.videos" | "downloads.audio" }[] = [
	{ key: "video", labelKey: "downloads.videos" },
	{ key: "audio", labelKey: "downloads.audio" },
];

interface FormatPickerProps {
	value: string;
	onChange: (value: string) => void;
}

export function FormatPicker({ value, onChange }: FormatPickerProps) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [highlightIndex, setHighlightIndex] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	useClickOutside(containerRef, () => setOpen(false));

	const lowerQuery = query.toLowerCase();
	const filtered = query
		? ALL_OPTIONS.filter(
				(o) =>
					o.label.toLowerCase().includes(lowerQuery) ||
					o.value.toLowerCase().includes(lowerQuery),
			)
		: ALL_OPTIONS;

	const selectedOption = ALL_OPTIONS.find((o) => o.value === value);

	const openPicker = useCallback(() => {
		setOpen(true);
		setQuery("");
		setHighlightIndex(0);
	}, []);

	const selectItem = useCallback(
		(val: string) => {
			onChange(val);
			setOpen(false);
			setQuery("");
		},
		[onChange],
	);

	const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(e.target.value);
		setHighlightIndex(0);
	};

	const handleInputKeyDown = (e: React.KeyboardEvent) => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				setHighlightIndex((i) => Math.max(i - 1, 0));
				break;
			case "Enter":
				e.preventDefault();
				if (filtered[highlightIndex]) {
					selectItem(filtered[highlightIndex].value);
				}
				break;
			case "Escape":
				e.preventDefault();
				setOpen(false);
				break;
		}
	};

	let runningIndex = 0;

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={openPicker}
				className="flex h-12 w-[160px] items-center justify-between rounded-lg border-none bg-[#1E293B] px-4 text-sm font-medium text-foreground"
			>
				<span>{selectedOption?.label ?? ALL_OPTIONS[0].label}</span>
				<ChevronDown className="size-4 opacity-50" />
			</button>

			{open && (
				<div className="absolute top-full right-0 z-50 mt-1 w-[200px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
					<div className="border-b border-border p-2">
						<input
							autoFocus
							type="text"
							value={query}
							onChange={handleQueryChange}
							onKeyDown={handleInputKeyDown}
							placeholder={t("dashboard.formatSearch")}
							className="h-8 w-full rounded-md bg-[#1E293B] px-3 text-sm text-foreground placeholder:text-[#475569] focus:outline-none"
						/>
					</div>
					<div className="max-h-[240px] overflow-y-auto p-1">
						{filtered.length === 0 ? (
							<div className="px-3 py-2 text-sm text-muted-foreground">
								{t("dashboard.noFormatFound")}
							</div>
						) : (
							GROUP_CONFIG.map(({ key: group, labelKey }, gi) => {
								const items = filtered.filter((o) => o.group === group);
								if (items.length === 0) return null;
								const startIndex = runningIndex;
								runningIndex += items.length;
								return (
									<div key={group}>
										{gi > 0 && (
											<div className="mx-2 my-1 h-px bg-border/50" />
										)}
										<div className="px-3 pb-1 pt-1.5 text-xs font-medium tracking-widest text-muted-foreground/60 uppercase">
											{t(labelKey)}
										</div>
										{items.map((option, i) => {
											const idx = startIndex + i;
											return (
												<button
													key={option.value}
													type="button"
													onClick={() => selectItem(option.value)}
													className={`flex w-full items-center rounded-md px-3 py-1.5 text-sm ${
														idx === highlightIndex
															? "bg-accent text-accent-foreground"
															: "text-foreground hover:bg-accent/50"
													} ${option.value === value ? "font-semibold" : ""}`}
												>
													{option.label}
												</button>
											);
										})}
									</div>
								);
							})
						)}
					</div>
				</div>
			)}
		</div>
	);
}
