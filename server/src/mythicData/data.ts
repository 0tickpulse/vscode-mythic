import { MythicData, MythicFieldTypeString, MythicHovers } from "./types.js";
import { generateHover } from "./services.js";
import { MFMythicSkill } from "./specialTypes/mythicSkillType.js";
import { MFSwitchCases } from "./specialTypes/mythicSwitchCasesType.js";

export const data = {
    mechanic: [
        {
            names: ["message", "msg", "m"],
            description: "Sends a message to the target entity.",
            fields: [
                {
                    names: ["message", "msg", "m"],
                    description: "The message to send.",
                    type: new MythicFieldTypeString(),
                },
            ],
            examples: [
                {
                    text: "message{m=You have <target.health> health left.} @Target",
                    explanation: "Sends a message to the target entity with their health.",
                },
            ],
        },
        {
            names: ["orbital", "o"],
            description: "Applies an orbital aura to the target.",
        },
        {
            names: ["variableSet"],
            description: "Sets a variable to a value.",
        },
        {
            names: ["skill"],
            description: "Runs a skill.",
            fields: [
                {
                    names: ["skill", "s"],
                    description: "The skill to run.",
                    type: new MFMythicSkill(),
                }
            ]
        },
        {
            names: ["switch"],
            description: "Switches between different cases.",
            fields: [
                {
                    names: ["cases", "c"],
                    description: "The cases to switch between.",
                    type: new MFSwitchCases(),
                }
            ]
        }
    ],
    condition: [],
    targeter: [],
} satisfies MythicData;

export const typedData: MythicData = data as MythicData;

export const compiledHovers: MythicHovers = {
    mechanic: typedData.mechanic.map((m) => ({ names: m.names, generate: (n: string) => generateHover("mechanic", n, m) })),
    condition: typedData.condition.map((c) => ({ names: c.names, generate: (n: string) => generateHover("condition", n, c) })),
    targeter: typedData.targeter.map((t) => ({ names: t.names, generate: (n: string) => generateHover("targeter", n, t) })),
};

export const VARIABLE_SCOPES = ["caster", "target", "trigger", "parent", "global"] as const;
