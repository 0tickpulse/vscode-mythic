import { Color } from "tick-ts-utils";
import { SemanticTokenTypes } from "vscode-languageserver";
import { Node, isScalar } from "yaml";
import { Highlight, ColorHint } from "../../../colors.js";
import { CustomRange } from "../../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import materials from "../bigData/materials.js";
import { YMap, YObj, YUnion, YString, YArr, YNum, SchemaValidationError, YamlSchema } from "../schemaTypes.js";
import { mdSeeAlso } from "../../../utils/utils.js";
import { getNodeValueRange } from "../schemaUtils.js";

class YItemColor extends YString {
    constructor() {
        super();
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const errors = super.preValidate(doc, value);
        if (!isScalar(value)) {
            return []; // unreachable but isScalar is a type guard
        }
        if (errors.length > 0) {
            return errors;
        }
        const colors = value.toString().split(",");
        if (colors.length !== 3) {
            return [
                new SchemaValidationError(
                    this,
                    "Invalid color. Must be in the format of `R,G,B` where `R`, `G`, and `B` are integers between 0 and 255.",
                    doc,
                    value,
                ),
            ];
        }
        const parsedColors = [];
        const colorTypes = ["red", "green", "blue"];
        const { range: nodeRange, yamlRange } = getNodeValueRange(doc, value);
        let offset = 0;
        for (const color of colors) {
            const num = parseInt(color);
            const rangeStart = yamlRange[0] + offset;
            const rangeEnd = rangeStart + color.length;
            const range = CustomRange.fromYamlRange(doc.lineLengths, [rangeStart, rangeEnd, rangeEnd]);
            offset += color.length + 1; // +1 for the comma
            parsedColors.push(num);
            const colorType = colorTypes.shift();
            if (isNaN(num)) {
                errors.push(new SchemaValidationError(this, `Invalid ${colorType} value. Must be an integer.`, doc, value, range));
                continue;
            }
            if (num < 0 || num > 255) {
                errors.push(new SchemaValidationError(this, `Invalid ${colorType} value. Must be between 0 and 255.`, doc, value, range));
                // no continue here because we still want to add the highlight
            }
            doc.addHighlight(new Highlight(range, SemanticTokenTypes.number));
        }
        if (errors.length > 0) {
            return errors;
        }
        const [red, green, blue] = parsedColors;
        const parsedColor = new Color(red, green, blue);
        const range = CustomRange.fromYamlRange(doc.lineLengths, value.range!);
        doc.colorHints.push(
            new ColorHint(range, parsedColor, "Modify item color", (newColor) => ({
                range,
                newText: `${newColor.red * 255},${newColor.green * 255},${newColor.blue * 255}`,
            })),
        );

        return [];
    }
}
export const mythicItemSchema: YamlSchema = new YMap(
    new YObj({
        Id: {
            schema: YUnion.nonCaseSensitiveLiterals(...materials).setName("material_type"),
            required: true,
            description: "The material type of the item." + mdSeeAlso("Items/Items#id"),
        },
        Display: {
            schema: new YString(),
            required: false,
            description: "The display name of the item." + mdSeeAlso("Items/Items#display"),
        },
        Group: {
            schema: new YString(), // TODO: Have this be generated from the ast
            required: false,
            description: "The group of the item for the Item Browser." + mdSeeAlso("Items/Items#group"),
        },
        Lore: {
            schema: new YArr(new YString()),
            required: false,
            description: "The lore of the item." + mdSeeAlso("Items/Items#lore"),
        },
        CustomModelData: {
            schema: new YNum(0, undefined, true, true, true),
            required: false,
            description: "The custom model data of the item." + mdSeeAlso("Items/Items#custommodeldata"),
        },
        Model: {
            schema: new YNum(0, undefined, true, true, true),
            required: false,
            description: "An alias for CustomModelData." + mdSeeAlso("Items/Items#custommodeldata"),
        },
        Options: {
            schema: new YObj({
                Color: {
                    schema: new YItemColor(),
                    required: false,
                    description: "The color of the item.",
                },
            }),
            required: false,
            description: "Some other sub-options of the item." + mdSeeAlso("Items/Items#options", "Items/Options"),
        },
    }),
);
