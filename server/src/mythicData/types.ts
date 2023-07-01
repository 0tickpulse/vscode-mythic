import { Hover } from "vscode-languageserver";
import { RangeLink, DocumentInfo } from "../yaml/parser/documentInfo.js";
import { CustomRange } from "../utils/positionsAndRanges.js";
import { MlcValueExpr } from "../mythicParser/parserExpressions.js";

export type MythicHolderType = "mechanic" | "condition" | "targeter";

export type MythicData = Record<MythicHolderType, MythicHolder[]>;

export type MythicHovers = Record<MythicHolderType, { names: string[]; generate: (name: string) => Hover }[]>;

export type MythicHolder = {
    /**
     * The names of the mechanic, condition, or targeter.
     * The first name is the primary name, and the rest are aliases.
     */
    names: [string, ...string[]];
    description?: string;
    examples?: Example[];
    fields?: MythicField[];
    pluginRequirements?: PluginRequirement[];
    definition?: {
        range: CustomRange;
        doc: DocumentInfo;
    };
};

export type MythicField = {
    names: string[];
    description?: string;
    examples?: Example[];
    required?: boolean;
    type: MythicFieldType;
    pluginRequirements?: PluginRequirement[];
    default?: string;
    placeholder?: string;
};

export type Example = {
    text: string;
    explanation?: string;
};

export type PluginRequirement = "MythicMobs Premium" | "ModelEngine" | "MMOCore" | "MMOItems" | "MythicEnchants" | "MythicAchievements";

export class MythicFieldType {
    validate(value: MlcValueExpr): void {
        // do nothing. should be overridden
    }
}

export class MythicFieldTypeString {
    validate(value: MlcValueExpr): void {
        // do nothing. is always valid
    }
}
