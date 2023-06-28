import levenshtein from "js-levenshtein";
import { Optional } from "tick-ts-utils";

export function getClosestTo(value: string, values: string[], maxDistance = 3) {
    let closest: string | undefined;
    let closestDistance = maxDistance;
    for (const other of values) {
        const distance = levenshtein(value, other);
        if (distance < closestDistance) {
            closest = other;
            closestDistance = distance;
        }
    }
    return closest;
}

export function wrapInInlineCode(value: string) {
    return "`" + value + "`";
}

/**
 * Combines `filter` and `map` into a single operation.
 * The advantage of this is that it only iterates over the array once instead of twice (once for `filter` and once for `map`).
 * JavaScript's array methods are not lazy, so this is a significant performance improvement.
 *
 * @param array  The array to filter and map.
 * @param filter The filter function. This should return an Optional containing the mapped value if the value should be included in the result.
 */
export function filterMap<T, U>(array: T[], filter: (value: T) => Optional<U>): U[] {
    const result: U[] = [];
    const len = array.length;
    // traditional for loop for performanxe
    for (let i = 0; i < len; i++) {
        const value = array[i];
        filter(value).ifPresent((mapped) => result.push(mapped));
    }
    return result;
}

/**
 * A placeholder function for something that has not been implemented yet.
 *
 * @param message The message to log to the console.
 */
export function todo(message = "Implement") {
    console.warn(`Hit TODO: ${message}`);
}

export function mdLinkWiki(path: string) {
    return `[🔗 Wiki: ${path.replace(/-/g, " ")}](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/${path})`;
}

export function mdSeeAlso(...paths: string[]) {
    return `\n\n## See Also\n\n${paths.map((path) => `* ${mdLinkWiki(path)}`).join("\n\n")}`;
}
