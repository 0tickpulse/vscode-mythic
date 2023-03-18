export type ArrayIncludes<TArray extends readonly any[], TItem> = TItem extends TArray[number] ? true : false;
export type FilterArrayIncludes<TArray extends readonly any[], TItem> = TArray extends [infer TFirst, ...infer TRest]
    ? TFirst extends TItem
        ? [...FilterArrayIncludes<TRest, TItem>, TFirst]
        : FilterArrayIncludes<TRest, TItem>
    : [];

export type FilterArrayKeyIncludes<TArray extends readonly unknown[], TKey extends PropertyKey, TItem> = TArray extends [infer TFirst, ...infer TRest]
    ? TFirst extends Record<TKey, unknown[]>
        ? ArrayIncludes<TFirst[TKey], TItem> extends true
            ? [TFirst, ...FilterArrayKeyIncludes<TRest, TKey, TItem>]
            : FilterArrayKeyIncludes<TRest, TKey, TItem>
        : FilterArrayKeyIncludes<TRest, TKey, TItem>
    : [];

/**
 * @example
 * ```ts
 * type Test = MapKey<[{
 * a: "3";
 * b: number;
 * }, {
 * a: "x";
 * b: number;
 * }, {
 * a: "d";
 * b: number;
 * }], "a">
 * // ["3", "x", "d"]
 * ```
 */
export type MapKey<TObject extends Record<PropertyKey, unknown>[], TKey extends keyof TObject[number]> = {
    [K in keyof TObject]: TObject[K][TKey];
};

type Test = FilterArrayKeyIncludes<
    //   ^?
    [
        {
            a: ["3"];
            b: number;
        },
        {
            a: ["x"];
            b: number;
        },
        {
            a: ["d"];
            b: number;
        },
    ],
    "a",
    "3"
>;
