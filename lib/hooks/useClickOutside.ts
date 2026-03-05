import { useEffect, useRef } from "react";

/** 指定要素の外側クリックでコールバックを実行するフック */
export function useClickOutside(
	ref: React.RefObject<HTMLElement | null>,
	onClose: () => void,
) {
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				onCloseRef.current();
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [ref]);
}
