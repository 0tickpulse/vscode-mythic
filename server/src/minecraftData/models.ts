import { Hover } from "vscode-languageserver";

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

// export type MythicFieldType =
//     | {
//           type: "string";
//       }
//     | {
//           type: "array";
//           items: MythicFieldType;
//       }
//     | {
//           type: "number";
//           lowerBound?: number;
//           upperBound?: number;
//       }
//     | {
//           type: "boolean";
//       }
//     | {
//           type: "enum";
//           values: string[];
//       }
//     | {
//           type: "inlineSkill";
//       }
//     | {
//           type: "inlineItem";
//       }
//     | {
//           type: "mythicTargeter";
//       }
//     | {
//           type: "inlineCondition";
//       }
//     | {
//           type: "potion";
//       }
//     | {
//           type: "mythicMob";
//       };

// convert all the above to individual types

export type MythicFieldType =
    | MythicFieldTypeString
    | MythicFieldTypeArray
    | MythicFieldTypeNumber
    | MythicFieldTypeBoolean
    | MythicFieldTypeEnum
    | MythicFieldTypeInlineSkill
    | MythicFieldTypeInlineItem
    | MythicFieldTypeMythicTargeter
    | MythicFieldTypeInlineCondition
    | MythicFieldTypePotion
    | MythicFieldTypeEnchantment
    | MythicFieldTypeMythicMob;

export type MythicFieldTypeString = {
    type: "string";
};

export type MythicFieldTypeArray = {
    type: "array";
    items: MythicFieldType;
};

export type MythicFieldTypeNumber = {
    type: "number";

    lowerBound?: number;
    upperBound?: number;
};

export type MythicFieldTypeBoolean = {
    type: "boolean";
};

export type MythicFieldTypeEnum = {
    type: "enum";
    values: string[];
};

export type MythicFieldTypeInlineSkill = {
    type: "inlineSkill";
};

export type MythicFieldTypeInlineItem = {
    type: "inlineItem";
};

export type MythicFieldTypeMythicTargeter = {
    type: "mythicTargeter";
};

export type MythicFieldTypeInlineCondition = {
    type: "inlineCondition";
};

export type MythicFieldTypePotion = {
    type: "potion";
};

export type MythicFieldTypeEnchantment = {
    type: "enchantment";
}

export type MythicFieldTypeMythicMob = {
    type: "mythicMob";
};
