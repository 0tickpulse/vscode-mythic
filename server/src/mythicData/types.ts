import { Diagnostic, Hover } from "vscode-languageserver";
import { RangeLink, DocumentInfo } from "../yaml/parser/documentInfo.js";
import { CustomRange } from "../utils/positionsAndRanges.js";
import { MlcValueExpr } from "../mythicParser/parserExpressions.js";
import { Optional } from "tick-ts-utils";

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
    name?: string;
    validate(doc: DocumentInfo, value: MlcValueExpr): void {
        // do nothing. should be overridden
    }
    get typeText() {
        return this.name ?? this.rawTypeText;
    }
    get rawTypeText() {
        return "unknown";
    }
}

export class InvalidFieldValueError implements Diagnostic {
    constructor(public message: string, public value: MlcValueExpr, public range: CustomRange = value.range) {}
    code = 0;
}

export class MythicFieldTypeString extends MythicFieldType {
    literal: Optional<string>;
    constructor(literal?: string, public caseSensitive = false) {
        super();
        this.literal = Optional.of(literal);
    }
    validate(doc: DocumentInfo, value: MlcValueExpr): void {
        const str = value.getSource();
        this.literal.ifPresent((literal) => {
            if (this.caseSensitive) {
                if (str !== literal) {
                    doc.addError(new InvalidFieldValueError(`Expected ${literal}, got ${str}`, value));
                }
            } else {
                if (str.toLowerCase() !== literal.toLowerCase()) {
                    doc.addError(new InvalidFieldValueError(`Expected ${literal}, got ${str}`, value));
                }
            }
        });
    }
}
