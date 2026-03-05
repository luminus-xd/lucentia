/** サポートするロケール */
export type Locale = "ja" | "en";

/** ネストされたオブジェクトのリーフノードへのドットパスキーを生成する型 */
export type NestedKeyOf<T> = T extends object
	? {
			[K in keyof T & string]: T[K] extends object
				? `${K}.${NestedKeyOf<T[K]>}`
				: `${K}`;
		}[keyof T & string]
	: never;

/** テンプレート補間のパラメータ型 */
export type InterpolationParams = Record<string, string | number>;

/** リテラル型のリーフをすべて string に変換する（翻訳ファイルの構造チェック用） */
export type DeepStringify<T> = {
	[K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};
