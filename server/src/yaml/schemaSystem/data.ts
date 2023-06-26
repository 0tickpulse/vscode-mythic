import picomatch from "picomatch";
import {
    YamlSchema,
    YamlSchemaString as YString,
    YamlSchemaArray as YArr,
    YamlSchemaMap as YMap,
    YamlSchemaMythicCondition as YCond,
    YamlSchemaMythicSkill as YSkill,
    YamlSchemaNumber as YNum,
    YamlSchemaObject as YObj,
    YamlSchemaMythicSkillMap,
} from "./schemaTypes.js";

export const mythicSkillSchema: YamlSchema = new YamlSchemaMythicSkillMap(
    new YObj({
        Conditions: { schema: new YArr(new YCond()), required: false, description: "Conditions on the caster that must be met for this skill to be used.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#Conditions](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#conditions)" },
        TargetConditions: { schema: new YArr(new YCond()), required: false, description: "Conditions on the target that must be met for this skill to be used on a target.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#TargetConditions](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#targetconditions)" },
        TriggerConditions: { schema: new YArr(new YCond()), required: false, description: "Conditions on the trigger that must be met for this skill to be used.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#TriggerConditions](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#triggerconditions)" },
        Cooldown: { schema: new YNum(0), required: false, description: "The cooldown of this skill in seconds.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#Cooldown](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#cooldown)" },
        OnCooldownSkill: { schema: new YString(), required: false, description: "The skill to use when this skill is on cooldown.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#OnCooldownSkill](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#oncooldownskill)" },
        Skills: { schema: new YArr(new YSkill()), required: false, description: "The mechanics that are run when this skill is used.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#Skills](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#skills)" },
    }).setName("MythicSkillMap"),
);

export const PATH_MAP = new Map<string, { schema: YamlSchema; picoMatch: picomatch.Matcher }>();

function addPath(path: string, schema: YamlSchema) {
    PATH_MAP.set(path, {
        schema,
        picoMatch: picomatch(path)
    });
}

addPath("**/plugins/MythicMobs/Skills/*.yml", mythicSkillSchema);
addPath("**/plugins/MythicMobs/Skills/*.yaml", mythicSkillSchema);
addPath("**/plugins/MythicMobs/Skills/*.mythic", mythicSkillSchema);
addPath("**/plugins/MythicMobs/Packs/*/Skills/*.yml", mythicSkillSchema);
addPath("**/plugins/MythicMobs/Packs/*/Skills/*.yaml", mythicSkillSchema);
addPath("**/plugins/MythicMobs/Packs/*/Skills/*.mythic", mythicSkillSchema);
