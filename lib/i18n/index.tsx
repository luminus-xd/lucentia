"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import type {
	Locale,
	NestedKeyOf,
	InterpolationParams,
} from "./types";
import { ja, type Translations } from "./locales/ja";
import { en } from "./locales/en";

const STORAGE_KEY = "lucentia-locale";
const DEFAULT_LOCALE: Locale = "ja";

const locales: Record<Locale, Translations> = { ja, en };

export type TranslationKey = NestedKeyOf<Translations>;

/** ドットパスで翻訳オブジェクトからリーフ値を取得する */
function getNestedValue(obj: unknown, path: string): string | undefined {
	const keys = path.split(".");
	let current = obj;
	for (const key of keys) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return typeof current === "string" ? current : undefined;
}

/** {{key}} 形式のテンプレートを補間する */
function interpolate(
	template: string,
	params?: InterpolationParams,
): string {
	if (!params) return template;
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
		return params[key] != null ? String(params[key]) : `{{${key}}}`;
	});
}

interface I18nContextValue {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: (key: TranslationKey, params?: InterpolationParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
	if (typeof window === "undefined") return DEFAULT_LOCALE;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "ja" || stored === "en") return stored;
	return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

	const setLocale = useCallback((newLocale: Locale) => {
		setLocaleState(newLocale);
		localStorage.setItem(STORAGE_KEY, newLocale);
	}, []);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const t = useCallback(
		(key: TranslationKey, params?: InterpolationParams): string => {
			const value = getNestedValue(locales[locale], key);
			if (value != null) return interpolate(value, params);
			const fallback = getNestedValue(locales.ja, key);
			return interpolate(fallback ?? key, params);
		},
		[locale],
	);

	return (
		<I18nContext.Provider value={{ locale, setLocale, t }}>
			{children}
		</I18nContext.Provider>
	);
}

export function useTranslation() {
	const context = useContext(I18nContext);
	if (!context) {
		throw new Error("useTranslation must be used within I18nProvider");
	}
	return context;
}

/** useCallback の依存配列に t を入れずに最新の t を参照するための安定Ref */
export function useStableT() {
	const { t } = useTranslation();
	const tRef = useRef(t);
	tRef.current = t;
	return tRef;
}

/**
 * Rust側からのエラーキー（error.xxx_yyy:detail）を翻訳する
 * キーに対応する翻訳が見つからない場合は元の文字列をそのまま返す
 */
export function translateRustError(
	error: string,
	t: (key: TranslationKey, params?: InterpolationParams) => string,
): string {
	if (!error.startsWith("error.")) return error;

	const colonIdx = error.indexOf(":", 6);
	const key = colonIdx >= 0 ? error.substring(0, colonIdx) : error;
	const detail =
		colonIdx >= 0 ? error.substring(colonIdx + 1).trim() : undefined;

	const snakeKey = key.slice(6);
	const camelKey = snakeKey.replace(/_([a-z])/g, (_, c: string) =>
		c.toUpperCase(),
	);
	const i18nKey = `errors.${camelKey}` as TranslationKey;

	const translated = t(i18nKey);
	if (translated !== i18nKey) {
		return detail ? `${translated}: ${detail}` : translated;
	}
	return error;
}

export type { Locale, InterpolationParams };
