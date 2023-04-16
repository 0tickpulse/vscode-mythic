import picomatch from "picomatch";
import {
    YamlSchema,
    YamlSchemaArray as YArr,
    YamlSchemaMap as YMap,
    YamlSchemaMythicCondition as YCond,
    YamlSchemaMythicSkill as YSkill,
    YamlSchemaNumber as YNum,
    YamlSchemaObject as YObj,
} from "./schemaTypes.js";

export const mythicSkillSchema: YamlSchema = new YMap(
    new YObj({
        Conditions: { schema: new YArr(new YCond()), required: false, description: "Conditions on the caster that must be met for this skill to be used." },
        TargetConditions: { schema: new YArr(new YCond()), required: false, description: "Conditions on the target that must be met for this skill to be used on a target." },
        TriggerConditions: { schema: new YArr(new YCond()), required: false, description: "Conditions on the trigger that must be met for this skill to be used." },
        Cooldown: { schema: new YNum(0), required: false, description: "The cooldown of this skill in seconds." },
        Skills: { schema: new YArr(new YSkill()), required: false, description: "The skills that are used when this skill is used." },
    }),
);

export const PATH_MAP = new Map<string, { schema: YamlSchema; picoMatch: picomatch.Matcher }>();

function addPath(path: string, schema: YamlSchema) {
    PATH_MAP.set(path, {
        schema,
        picoMatch: picomatch(path)
    });
}

addPath("**/plugins/MythicMobs/Skills/*.yml", mythicSkillSchema);
addPath("**/plugins/MythicMobs/Packs/*/Skills/*.yml", mythicSkillSchema);
