import { MythicData, MythicHovers } from "./models.js";
import { generateHover } from "./services.js";

export const data = ({
    mechanic: [
        {
            names: ["message", "msg", "m"],
            description: "Sends a message to the target entity.",
            fields: [
                {
                    names: ["message", "msg", "m"],
                    description: "The message to send.",
                    type: {
                        type: "string"
                    }
                }
            ],
        },
        {
            names: ["orbital", "o"],
            description: "Applies an orbital aura to the target.",
        },
        {
            names: ["variableSet"],
            description: "Sets a variable to a value.",
        }
    ],
    condition: [],
    targeter: [],
}) satisfies MythicData;

export const typedData: MythicData = data as any;

type a = any;

export const compiledHovers: MythicHovers = {
    mechanic: typedData.mechanic.map((m) => ({ names: m.names, generate: (n: string) => generateHover("mechanic", n, m) })),
    condition: typedData.condition.map((c) => ({ names: c.names, generate: (n: string) => generateHover("condition", n, c) })),
    targeter: typedData.targeter.map((t) => ({ names: t.names, generate: (n: string) => generateHover("targeter", n, t) })),
};

export const VARIABLE_SCOPES = ["caster", "target", "trigger", "parent", "global"] as const;
