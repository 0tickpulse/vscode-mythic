import { SemanticTokenTypes } from "vscode-languageserver";
import { CustomRange, NumericRange } from "./utils/positionsAndRanges.js";

export const SEMANTIC_TOKEN_TYPES: SemanticTokenTypes[] = [
    SemanticTokenTypes.namespace,
    SemanticTokenTypes.type,
    SemanticTokenTypes.class,
    SemanticTokenTypes.enum,
    SemanticTokenTypes.interface,
    SemanticTokenTypes.struct,
    SemanticTokenTypes.typeParameter,
    SemanticTokenTypes.parameter,
    SemanticTokenTypes.variable,
    SemanticTokenTypes.property,
    SemanticTokenTypes.enumMember,
    SemanticTokenTypes.event,
    SemanticTokenTypes.function,
    SemanticTokenTypes.method,
    SemanticTokenTypes.macro,
    SemanticTokenTypes.keyword,
    SemanticTokenTypes.modifier,
    SemanticTokenTypes.comment,
    SemanticTokenTypes.string,
    SemanticTokenTypes.number,
    SemanticTokenTypes.regexp,
    SemanticTokenTypes.operator,
    SemanticTokenTypes.decorator,
];

/**
 * @template ColorFormat The format the color takes. Color is a RGB color, string is a CSS color.
 */
export class Highlight {
    constructor(public range: CustomRange, public color: SemanticTokenTypes) {}
    getColorIndex() {
        return SEMANTIC_TOKEN_TYPES.indexOf(this.color);
    }
}
