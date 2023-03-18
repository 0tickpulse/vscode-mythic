import { Optional } from "tick-ts-utils";
import { InvalidFieldValueError } from "../errors.js";
import { MlcPlaceholderExpr, MlcValueExpr } from "../mythicParser/parserExpressions.js";
import { getClosestTo } from "../utils/utils.js";
import { compiledHovers, data, typedData } from "./data.js";
import {
    MythicData,
    MythicField,
    MythicFieldType,
    MythicFieldTypeArray,
    MythicFieldTypeBoolean,
    MythicFieldTypeEnchantment,
    MythicFieldTypeEnum,
    MythicFieldTypeInlineCondition,
    MythicFieldTypeInlineItem,
    MythicFieldTypeInlineSkill,
    MythicFieldTypeMythicMob,
    MythicFieldTypeMythicTargeter,
    MythicFieldTypeNumber,
    MythicFieldTypePotion,
    MythicFieldTypeString,
    MythicHolder,
} from "./models.js";
import { ArrayIncludes, FilterArrayKeyIncludes } from "../utils/types.js";
import { Hover } from "vscode-languageserver";

export type MechanicsAndAliases = typeof data.mechanic[number]["names"];
export type ConditionsAndAliases = typeof data.condition[number]["names"];
export type TargetersAndAliases = typeof data.targeter[number]["names"];
/**
 * @example
 * ```ts
 * type Test = GetMechanic<"message"> // { names: ["message", "msg", "m"], description: "Sends a message to the target entity.", fields: [] }
 * ```
 */
export type GetMechanic<T extends MechanicsAndAliases[number]> = FilterArrayKeyIncludes<typeof data.mechanic, "names", T>;

type A = GetMechanic<"m">;
//   ^?
type b = typeof data.mechanic
//   ^?

export function getAllMechanicsAndAliases(): string[] {
    return typedData.mechanic.flatMap((m) => m.names);
}

export function getAllConditionsAndAliases(): string[] {
    return typedData.condition.flatMap((c) => c.names);
}

export function getAllTargetersAndAliases(): string[] {
    return typedData.targeter.flatMap((t) => t.names);
}

export function getHolderFromName(type: keyof MythicData, name: string): Optional<MythicHolder> {
    return Optional.of(typedData[type].find((h) => h.names.includes(name)));
}

export function getHolderFieldFromName(holder: MythicHolder, name: string): Optional<MythicField> {
    return Optional.of(holder.fields?.find((f) => f.names.includes(name)));
}

export function generateHover(type: keyof MythicData, name: string, holder: MythicHolder): Hover {
    const typeString = type.slice(0, 1).toUpperCase() + type.slice(1);
    const lines: string[] = [];
    lines.push(`# ${typeString}: ${name}`);
    if (holder.description !== undefined) {
        lines.push(holder.description ?? "");
    }
    if (holder.fields) {
        lines.push("## Fields");
        for (const [fieldName, field] of Object.entries(holder.fields)) {
            lines.push(generateHoverForField(name, type, fieldName, field));
        }
    }
    if (holder.pluginRequirements) {
        lines.push("## !! Required plugins:");
        lines.push(...holder.pluginRequirements.map((req) => `* ${req}`));
    }
    if (holder.examples) {
        lines.push("## Examples:");
        // TODO Use the custom language
        lines.push(
            ...holder.examples.map((example) => `\`\`\`yaml\n${example.text}\n\`\`\`` + (example.explanation ? `\n${example.explanation}` : "")),
        );
    }
    const result = lines.join("\n\n");
    return {
        contents: {
            kind: "markdown",
            value: result,
        }
    }
}

function generateHoverForField(name: string, type: keyof MythicData, fieldName: string, field: MythicField, standalone = false) {
    const lines: string[] = [];

    if (standalone) {
        lines.push(`## Field ${fieldName} in ${type} ${name}`);
        if (field.description !== undefined) {
            lines.push(field.description ?? "");
        }
    } else {
        lines.push(
            `* \`${fieldName}` +
                (field.placeholder !== undefined ? `=${field.placeholder}` : "") +
                `\`` +
                (field.description !== undefined ? ` - ${field.description}` : ""),
        );
    }

    if (field.pluginRequirements) {
        lines.push((standalone ? "##" : "###") + " !! Required plugins:");
        lines.push(...field.pluginRequirements.map((req) => `* ${req}`));
    }
    return lines.join("\n\n");
}

export function getHover(type: keyof MythicData, name: string) {
    return Optional.of(compiledHovers[type].find((h) => h.names.includes(name))?.generate(name));
}

export function getAllBasenames(type: keyof MythicData) {
    return compiledHovers[type].flatMap((h) => h.names[0]);
}

export function getAllNames(type: keyof MythicData) {
    return compiledHovers[type].flatMap((h) => h.names);
}

export function getAllFieldNames(type: keyof MythicData, name: string) {
    return Object.keys(typedData[type].find((d) => d.names.includes(name))?.fields ?? {});
}

export function getClosestMatch(type: keyof MythicData, name: string, distanceLimit = 3) {
    const closest = getClosestTo(name, getAllBasenames(type), distanceLimit);
    return closest ?? getClosestTo(name, getAllNames(type), distanceLimit);
}

export function isMythicFieldTypeString(field: MythicFieldType): field is MythicFieldTypeString {
    return field.type === "string";
}

export function isMythicFieldTypeArray(field: MythicFieldType): field is MythicFieldTypeArray {
    return field.type === "array";
}

export function isMythicFieldTypeNumber(field: MythicFieldType): field is MythicFieldTypeNumber {
    return field.type === "number";
}

export function isMythicFieldTypeBoolean(field: MythicFieldType): field is MythicFieldTypeBoolean {
    return field.type === "boolean";
}

export function isMythicFieldTypeEnum(field: MythicFieldType): field is MythicFieldTypeEnum {
    return field.type === "enum";
}

export function isMythicFieldTypeInlineSkill(field: MythicFieldType): field is MythicFieldTypeInlineSkill {
    return field.type === "inlineSkill";
}

export function isMythicFieldTypeInlineItem(field: MythicFieldType): field is MythicFieldTypeInlineItem {
    return field.type === "inlineItem";
}

export function isMythicFieldTypeMythicTargeter(field: MythicFieldType): field is MythicFieldTypeMythicTargeter {
    return field.type === "mythicTargeter";
}

export function isMythicFieldTypeInlineCondition(field: MythicFieldType): field is MythicFieldTypeInlineCondition {
    return field.type === "inlineCondition";
}

export function isMythicFieldTypePotion(field: MythicFieldType): field is MythicFieldTypePotion {
    return field.type === "potion";
}

export function isMythicFieldTypeEnchantment(field: MythicFieldType): field is MythicFieldTypeEnchantment {
    return field.type === "enchantment";
}

export function isMythicFieldTypeMythicMob(field: MythicFieldType): field is MythicFieldTypeMythicMob {
    return field.type === "mythicMob";
}

export function validate(fieldType: MythicFieldType, expr: MlcValueExpr): InvalidFieldValueError[] {
    if (expr.identifiers.some((i) => i instanceof MlcPlaceholderExpr)) {
        return []; // Can't validate placeholders
    }
    const value = expr.getSource();
    switch (fieldType.type) {
        case "string":
            return [];
        case "array":
            return []; // TODO
        case "number": {
            if (isNaN(Number(value))) {
                return [new InvalidFieldValueError(expr.parser.result.source, `Expected a number, got ${value}`, fieldType, expr)];
            }
            const number = Number(value);
            if (fieldType.lowerBound !== undefined && number < fieldType.lowerBound) {
                return [
                    new InvalidFieldValueError(
                        expr.parser.result.source,
                        `Expected a number greater than ${fieldType.lowerBound}, got ${value}`,
                        fieldType,
                        expr,
                    ),
                ];
            }
            if (fieldType.upperBound !== undefined && number > fieldType.upperBound) {
                return [
                    new InvalidFieldValueError(
                        expr.parser.result.source,
                        `Expected a number less than ${fieldType.upperBound}, got ${value}`,
                        fieldType,
                        expr,
                    ),
                ];
            }
            return [];
        }
        case "boolean": {
            if (value !== "true" && value !== "false") {
                return [new InvalidFieldValueError(expr.parser.result.source, `Expected a boolean, got ${value}`, fieldType, expr)];
            }
            return [];
        }
        case "enum": {
            if (!fieldType.values.includes(value)) {
                return [
                    new InvalidFieldValueError(
                        expr.parser.result.source,
                        `Expected one of ${fieldType.values.join(", ")}, got ${value}`,
                        fieldType,
                        expr,
                    ),
                ];
            }
            return [];
        }
        case "inlineSkill":
            return []; // TODO
        case "inlineItem":
            return []; // TODO
        case "mythicTargeter":
            return []; // TODO
        case "inlineCondition":
            return []; // TODO
        case "potion":
            return []; // TODO
        case "enchantment":
            return []; // TODO
        case "mythicMob":
            return []; // TODO
    }
}
