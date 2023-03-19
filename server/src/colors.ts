import { CustomRange } from "./utils/positionsAndRanges.js";

export class Color {
    constructor(public r: number, public g: number, public b: number) {}
    toCss() {
        return `rgb(${this.r},${this.g},${this.b})`;
    }
    static fromHex(hex: string): Color {
        return new Color(parseInt(hex.substring(1, 3), 16), parseInt(hex.substring(3, 5), 16), parseInt(hex.substring(5, 7), 16));
    }
}

function fromSGR(code: number | string): string {
    return `\x1b[${code}m`;
}

export function foregroundColor(r: number, g: number, b: number): string {
    return fromSGR(`38;2;${r};${g};${b}`);
}

export function addColorAnsi(color: Color, text: string) {
    return `\u001b[38;2;${color.r};${color.g};${color.b}m${text}\u001b[0m`;
}

export const COLORS = {
    brace: Color.fromHex("#D17B40"),
    yamlKey: Color.fromHex("#E06150"),
    colonAndEquals: /* random */ new Color(255, 255, 255),
    yamlValue: Color.fromHex("#76C379"),
    yamlValueNumber: Color.fromHex("#C99C6E"),
    mythicLineConfigSemicolon: new Color(255, 255, 255),
    placeholder: new Color(80, 80, 80),
    placeholderDot: new Color(200, 200, 200),
    mechanicName: Color.fromHex("#4FAFE9"),
    targeterAt: Color.fromHex("#3AA9B9"),
    targeterName: Color.fromHex("#3AA9B9"),
    triggerCaret: Color.fromHex("#3AA9B9"),
    triggerName: Color.fromHex("#3AA9B9"),
    triggerArg: Color.fromHex("#3AA9B9"),
    inlineConditionQuestion: Color.fromHex("#3AA9B9"),
    inlineConditionName: Color.fromHex("#3AA9B9"),
    inlineSkillBracket: Color.fromHex("#3AA9B9"),
    inlineSkillDash: new Color(255, 255, 255),
    chance: new Color(233, 30, 99),
    healthModifier: new Color(255, 193, 7),
} satisfies Record<PropertyKey, Color>;

/**
 * @template ColorFormat The format the color takes. Color is a RGB color, string is a CSS color.
 */
export class Highlight<ColorFormat extends Color | string = Color> {
    color: ColorFormat;
    public constructor(public range: CustomRange, color: ColorFormat) {
        this.color = color;
    }
}
