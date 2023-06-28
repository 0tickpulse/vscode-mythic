import { Alias, Node, Scalar } from "yaml";
import { DocumentInfo } from "../parser/documentInfo.js";
import { CustomRange } from "../../utils/positionsAndRanges.js";

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
