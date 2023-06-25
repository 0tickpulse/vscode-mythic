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

export function filterMap<T, U>(array: T[], filter: (value: T) => Optional<U>): U[] {
    const result: U[] = [];
    for (const value of array) {
        const mapped = filter(value);
        if (mapped.isPresent()) {
            result.push(mapped.get());
        }
    }
    return result;
}
