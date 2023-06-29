import { Color, Optional } from "tick-ts-utils";
import { SemanticTokenTypes } from "vscode-languageserver";
import { Node, Scalar, isMap, isScalar } from "yaml";
import { Highlight, ColorHint } from "../../../colors.js";
import { CustomRange } from "../../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import materials from "../bigData/materials.js";
import { YMap, YObj, YUnion, YString, YArr, YNum, SchemaValidationError, YamlSchema, YMythicSkill } from "../schemaTypes.js";
import { mdSeeAlso } from "../../../utils/utils.js";
import { getNodeValueRange, scalarValue } from "../schemaUtils.js";

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

const materialTypesSchema = YUnion.nonCaseSensitiveLiterals(...materials).setName("material_type");
materialTypesSchema.items.forEach((item) => {
    const stringSchema = item as YString; // this is safe because we know that the items are all YStrings
    stringSchema.completionItem.ifPresent((item) => {
        // this will directly modify the completion item in the schema, objects are passed by reference
        item.documentation = {
            kind: "markdown",
            value: `![Item ${item.label}](https://assets.mcasset.cloud/1.20.1/assets/minecraft/textures/item/${item.label}.png)`,
        };
    });
});

const attributeSchema = new YObj();
const attributeSlotSchema = new YObj();
for (const type of [
    "MaxHealth",
    "FollowRange",
    "KnockbackResistance",
    "MovementSpeed",
    "AttackDamage",
    "Armor",
    "ArmorToughness",
    "Luck",
    "AttackSpeed",
    "AttackKnockback",
    "FlyingSpeed",
]) {
    attributeSlotSchema.setProperty(type, new YNum());
}

for (const slot of ["mainhand", "offhand", "head", "chest", "legs", "feet", "all"]) {
    attributeSchema.setProperty(slot, attributeSlotSchema);
}

export const mythicItemSchema: YamlSchema = new YMap(
    new YObj({
        Id: {
            schema: materialTypesSchema,
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
        Attributes: {
            schema: attributeSchema,
            required: false,
            description: "The attributes of the item." + mdSeeAlso("Items/Items#attributes", "Items/Attributes"),
        },
        Amount: {
            schema: new YNum(1, 64, true, true, true),
            required: false,
            description: "The default amount of items to give when called by the plugin." + mdSeeAlso("Items/Items#amount"),
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
        Enchantments: {
            schema: new YArr(new YString()), // TODO
            required: false,
            description: "The enchantments of the item." + mdSeeAlso("Items/Items#enchantments", "Items/Enchantments"),
        },
        Hide: {
            schema: new YArr(
                YUnion.literals("ARMOR_TRIM", "ATTRIBUTES", "DESTROYS", "DYE", "ENCHANTS", "PLACED_ON", "POTION_EFFECTS", "UNBREAKABLE"),
            ),
            required: false,
            description: "Sets some flags to be hidden from the item's tooltip." + mdSeeAlso("Items/Items#hide"),
        },
        PotionEffects: {
            schema: new YArr(new YString()), // TODO
            required: false,
            description:
                "The potion effects of the item. Requires this item to have Id `potion`, `splash_potion`, `lingering_potion`, or `tipped_arrow`" +
                mdSeeAlso("Items/Items#potioneffects", "Items/PotionEffects"),
            conditions: [
                (doc, value) => {
                    const err = "PotionEffects requires the item to have id `potion`, `splash_potion`, `lingering_potion`, or `tipped_arrow`!";
                    if (!isMap(value)) {
                        return Optional.of(`${err} - not map`);
                    }
                    const id = value.items.find(i => (i.key as Scalar)?.value === "Id")?.value;
                    if (!id || !isScalar(id)) {
                        return Optional.of(`${err} - no id`);
                    }
                    const idValue = scalarValue(id);
                    if (!["potion", "splash_potion", "lingering_potion", "tipped_arrow"].includes(String(idValue))) {
                        return Optional.of(`${err} - id is incorrect`);
                    }
                    return Optional.empty();
                },
            ],
        },
        Skills: {
            schema: new YArr(new YMythicSkill(true)),
            required: false,
            description:
                "The skills of the item. Requires [🔗 MythicCrucible](https://mythiccraft.io/index.php?resources/crucible-create-unbelievable-mythic-items.2/)" +
                mdSeeAlso("Items/Items#skills"),
        },
    }),
);
