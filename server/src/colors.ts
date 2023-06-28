import { ColorInformation, ColorPresentation, SemanticTokenTypes, TextEdit } from "vscode-languageserver";
import { CustomRange } from "./utils/positionsAndRanges.js";
import { Color } from "tick-ts-utils";
import { Color as VsColor } from "vscode-languageserver";

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

export class ColorHint implements ColorInformation {
    constructor(public range: CustomRange, public color: Color, public label: string, public textEdit: (newColor: VsColor) => TextEdit) {
        // vscode colors are 0-1, but tick-ts-utils colors are 0-255
        this.color.red /= 255;
        this.color.green /= 255;
        this.color.blue /= 255;
    }
    applyTextEdit(newColor: VsColor): ColorPresentation {
        return {
            label: this.label,
            textEdit: this.textEdit(newColor),
        }
    }
}
