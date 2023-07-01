import { Optional } from "tick-ts-utils";
import { Hover } from "vscode-languageserver";
import { globalData } from "../documentManager.js";
import { FilterArrayKeyIncludes } from "../utils/types.js";
import { getClosestTo, wrapInInlineCode } from "../utils/utils.js";
import { compiledHovers, data, typedData } from "./data.js";
import {
    MythicData,
    MythicField,
    MythicHolder
} from "./types.js";

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
type b = typeof data.mechanic;
//   ^?

export function getAllMechanicsAndAliases(): string[] {
    return [...typedData.mechanic.flatMap((m) => m.names), ...globalData.mythic.skills.all().map((s) => `skill:${s.name}`)];
}

export function getAllConditionsAndAliases(): string[] {
    return typedData.condition.flatMap((c) => c.names);
}

export function getAllTargetersAndAliases(): string[] {
    return typedData.targeter.flatMap((t) => t.names);
}

export function getHolderFromName(type: keyof MythicData, name: string): Optional<MythicHolder> {
    if (type === "mechanic" && name.startsWith("skill:")) {
        const skillName = name.slice("skill:".length);
        const skill = globalData.mythic.skills.all().find((s) => s.name === skillName);
        if (skill) {
            return Optional.of({
                names: [name],
                description: `User-defined skill ${skillName}${(skill.description ? `\n\n${skill.description}` : ". No description provided.")}\n\nDefined in ${skill.doc.fmt()}:${skill.declarationRange.fmt()}`,
                definition: {
                    doc: skill.doc,
                    range: skill.declarationRange,
                }
            });
        }
    }
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
        for (const field of holder.fields) {
            lines.push(generateHoverForField(name, type, field.names[0], field));
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
        },
    };
}

export function generateHoverForField(name: string, type: keyof MythicData, fieldName: string, field: MythicField, standalone = false) {
    const lines: string[] = [];

    if (standalone) {
        lines.push(`## Field ${fieldName} in ${type} ${name}`);
        if (field.description !== undefined) {
            lines.push(field.description ?? "");
        }
    } else {
        lines.push(
            `* ${field.names.map(wrapInInlineCode).join(" | ")}` +
                (field.placeholder !== undefined ? `=${field.placeholder}` : "") +
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

export function getAllFields(type: keyof MythicData, name: string) {
    return getHolderFromName(type, name)
        .map((h) => h.fields ?? [])
        .otherwise([] as MythicField[]);
}

export function getClosestMatch(type: keyof MythicData, name: string, distanceLimit = 3) {
    const closest = getClosestTo(name, getAllBasenames(type), distanceLimit);
    return closest ?? getClosestTo(name, getAllNames(type), distanceLimit);
}
