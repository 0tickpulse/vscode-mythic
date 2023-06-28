import { YMythicSkillMap, YObj, YArr, YMythicCondition, YNum, YString, YMythicSkill, YamlSchema } from "../schemaTypes.js";

export const mythicSkillSchema: YamlSchema = new YMythicSkillMap(
    new YObj({
        Conditions: {
            schema: new YArr(new YMythicCondition()),
            required: false,
            description:
                "Conditions on the caster that must be met for this skill to be used.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#Conditions](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#conditions)",
        },
        TargetConditions: {
            schema: new YArr(new YMythicCondition()),
            required: false,
            description:
                "Conditions on the target that must be met for this skill to be used on a target.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#TargetConditions](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#targetconditions)",
        },
        TriggerConditions: {
            schema: new YArr(new YMythicCondition()),
            required: false,
            description:
                "Conditions on the trigger that must be met for this skill to be used.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#TriggerConditions](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#triggerconditions)",
        },
        Cooldown: {
            schema: new YNum(0, undefined, true),
            required: false,
            description:
                "The cooldown of this skill in seconds.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#Cooldown](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#cooldown)",
        },
        OnCooldownSkill: {
            schema: new YString(),
            required: false,
            description:
                "The skill to use when this skill is on cooldown.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#OnCooldownSkill](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#oncooldownskill)",
        },
        Skills: {
            schema: new YArr(new YMythicSkill(false)),
            required: false,
            description:
                "The mechanics that are run when this skill is used.\n\n## See Also\n\n* [🔗 Wiki: Skills/Metaskills#Skills](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills#skills)",
        },
    }).setName("mythic_skill_map"),
);
