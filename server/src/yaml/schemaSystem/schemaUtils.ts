import { Alias, Node, Scalar } from "yaml";
import { DocumentInfo } from "../parser/documentInfo.js";
import { CustomPosition, CustomRange, r } from "../../utils/positionsAndRanges.js";

/**
 * Gets the VALUE range of a node. This is the range of the value, not including quotes.
 *
 * @param param0 The document info.
 * @param param1 The node. Must be a scalar.
 */
export function getNodeValueRange({ lineLengths }: DocumentInfo, { range, type }: Scalar) {
    let rangeOffset = range!;
    if (type === "QUOTE_DOUBLE" || type === "QUOTE_SINGLE") {
        rangeOffset = [rangeOffset[0] + 1, rangeOffset[1] - 1, rangeOffset[2]];
    }
    return { range: CustomRange.fromYamlRange(lineLengths, rangeOffset), yamlRange: rangeOffset };
}

/**
 * A more performant version of getNodeValueRange that only returns the YAML range.
 *
 * @param param0 The document info.
 * @param param1 The node. Must be a scalar.
 */
export function getNodeValueYamlRange({ lineLengths }: DocumentInfo, { range, type }: Scalar) {
    let rangeOffset = range!;
    if (type === "QUOTE_DOUBLE" || type === "QUOTE_SINGLE") {
        rangeOffset = [rangeOffset[0] + 1, rangeOffset[1] - 1, rangeOffset[2]];
    }
    return rangeOffset;
}

/**
 * Returns true if either is true:
 * - The cursor is in the range
 * - Inbetween the range's end and the cursor is only whitespace
 *
 * @param doc    The document info.
 * @param range  The range.
 * @param cursor The cursor.
 */
export function cursorValidInRange(doc: DocumentInfo, range: CustomRange, cursor: CustomPosition) {
    if (range.contains(cursor)) {
        return true;
    }
    const newRange = r(range.end, cursor);
    const text = newRange.getFrom(doc.source);
    return text.trim() === "";
}

export function scalarValue({ value }: Scalar): string | number | boolean {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    return "";
}
