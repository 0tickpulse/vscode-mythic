import { ColorInformation, ColorPresentation, SemanticTokenTypes, TextEdit } from "vscode-languageserver";
import { CustomRange } from "./utils/positionsAndRanges.js";
import { Color } from "tick-ts-utils";
import { Color as VsColor } from "vscode-languageserver";
import { dbg } from "./utils/logging.js";

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

export const SEMANTIC_TOKEN_MODIFIERS = [
    "declaration",
] as const;
export type SemanticTokenModifier = typeof SEMANTIC_TOKEN_MODIFIERS[number];

/**
 * @template ColorFormat The format the color takes. Color is a RGB color, string is a CSS color.
 */
export class Highlight {
    constructor(public range: CustomRange, public color: SemanticTokenTypes, public modifiers: SemanticTokenModifier[] = []) {}
    getColorIndex() {
        return SEMANTIC_TOKEN_TYPES.indexOf(this.color);
    }
    get modifierBitFlag(): number {
        return this.modifiers.reduce((acc, m) => acc | (1 << SEMANTIC_TOKEN_MODIFIERS.indexOf(m)), 0);
    }
}

export class ColorHint implements ColorInformation {
    color: VsColor;
    constructor(
        public range: CustomRange,
        public tuColor: Color,
        public label: string,
        public textEdit: (newColor: Color) => TextEdit,
        public presentationLabel: (newColor: Color) => string = () => this.label,
    ) {
        // vscode colors are 0-1, but tick-ts-utils colors are 0-255
        this.color = {
            red: tuColor.red / 255,
            green: tuColor.green / 255,
            blue: tuColor.blue / 255,
            alpha: 1,
        };
    }
    applyTextEdit(newColor: VsColor): ColorPresentation {
        const color = new Color(newColor.red * 255, newColor.green * 255, newColor.blue * 255);
        return {
            label: this.presentationLabel(color),
            textEdit: this.textEdit(color),
        };
    }
    toString() {
        return `ColorHint(${this.range}, ${this.tuColor.toHex()}, ${this.label})`;
    }
}
