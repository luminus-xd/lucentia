"use client";

import type { ReactNode } from "react";

type SubColorVariant = "cyan" | "muted";

const subColorStyles: Record<SubColorVariant, string> = {
	cyan: "text-cyan",
	muted: "text-[#64748B]",
};

export function StatsCard({
	label,
	value,
	sub,
	subColor,
	icon,
}: {
	label: string;
	value: string;
	sub: ReactNode;
	subColor: SubColorVariant;
	icon: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3 rounded-xl bg-[#1E293B] p-5">
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-semibold tracking-[2px] text-[#64748B] uppercase">
					{label}
				</span>
				{icon}
			</div>
			<span className="font-mono text-[32px] font-bold leading-none">
				{value}
			</span>
			<span className={`text-xs ${subColorStyles[subColor]}`}>{sub}</span>
		</div>
	);
}
