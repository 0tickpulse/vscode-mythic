import levenshtein from "js-levenshtein";

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
