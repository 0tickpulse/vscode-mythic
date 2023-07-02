import { stripIndentation } from "tick-ts-utils";
import { SemanticTokenTypes } from "vscode-languageserver";
import { Node, isMap } from "yaml";
import { Highlight } from "../../../colors.js";
import { globalData } from "../../../documentManager.js";
import { CachedMythicSkill } from "../../../mythicModels.js";
import { Resolver } from "../../../mythicParser/resolver.js";
import { CustomPosition, CustomRange } from "../../../utils/positionsAndRanges.js";
import { mdSeeAlso } from "../../../utils/utils.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { SchemaValidationError, YArr, YMythicCondition, YMythicSkill, YMythicSkillArr, YNum, YObj, YString, YamlSchema } from "../schemaTypes.js";
import { } from "./mythicSkill.js";

export class YMythicSkillMap extends YamlSchema {
    static generateKeyHover(name: string) {
        return (
            stripIndentation`# MetaSkill: \`${name}\`
        Skills are a core feature of MythicMobs, allowing users to create custom abilities for their mobs or items that are triggered under various circumstances and with varying conditions.
        A metaskill is a list of skills that can be called using a [🔗 Meta Mechanic](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Mechanics#advancedmeta-mechanics).

        To declare a metaskill, use the following syntax:
        ` +
            `
        \`\`\`yaml
        internal_skillname:
          Cooldown: [seconds]
          OnCooldownSkill: [the metaskill to execute if this one is on cooldown]
          CancelIfNoTargets: [true/false]
          Conditions:
          - condition1
          - condition2
          TargetConditions:
          - condition3
          - condition4
          TriggerConditions:
          - condition5
          - condition6
          Skills:
          - mechanic1
          - mechanic2
        \`\`\`
        `
                .split("\n")
                .map((line) => line.substring(8))
                .join("\n") +
            stripIndentation`
        ## See Also

        * [🔗 Wiki: Skills](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Skills)
        * [🔗 Wiki: Metaskills](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills)
        `
        );
    }
    constructor(public valuesFn: (doc: DocumentInfo, cachedSkill: CachedMythicSkill) => YamlSchema) {
        super();
    }
    values!: YamlSchema;
    cached!: CachedMythicSkill
    override getDescription() {
        return "a map in which values are each a skill";
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value)];
        }

        const errors: SchemaValidationError[] = [];

        const { items } = value;
        for (const item of items) {
            if (item.key !== null) {
                const keyNode = item.key as Node;
                const key = keyNode.toString();
                const declarationRange = CustomRange.fromYamlRange(doc.lineLengths, keyNode.range!);
                const cachedSkill = new CachedMythicSkill(doc, [keyNode, item.value as Node], declarationRange, key);
                globalData.mythic.skills.add(cachedSkill);
                this.cached = cachedSkill;
                this.values = this.valuesFn(doc, cachedSkill);
                doc.addHover({
                    range: declarationRange,
                    contents: YMythicSkillMap.generateKeyHover(key),
                });
                doc.addHighlight(new Highlight(declarationRange, SemanticTokenTypes.function, ["declaration"]));
            }
            const error = this.values.runPreValidation(doc, item.value as Node);
            errors.push(...error);
        }
        return errors;
    }
    override postValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (!isMap(value)) {
            return [];
        }
        const errors: SchemaValidationError[] = [];
        const { items } = value;
        for (const item of items) {
            const error = this.values.runPostValidation(doc, item.value as Node);
            errors.push(...error);
        }
        return errors;
    }
    override autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        isMap(value) &&
            value.items.forEach((item) => {
                this.values.autoComplete(doc, item.value as Node, cursor);
            });
    }
    get rawTypeText() {
        return `map(${this.values.typeText})`;
    }
}

export const mythicSkillSchema: YamlSchema = new YMythicSkillMap(
    (doc, cached) => new YObj({
        Conditions: {
            schema: new YArr(new YMythicCondition()),
            required: false,
            description: "Conditions on the caster that must be met for this skill to be used." + mdSeeAlso("Metaskills#conditions"),
        },
        TargetConditions: {
            schema: new YArr(new YMythicCondition()),
            required: false,
            description:
                "Conditions on the target that must be met for this skill to be used on a target." + mdSeeAlso("Metaskills#targetconditions"),
        },
        TriggerConditions: {
            schema: new YArr(new YMythicCondition()),
            required: false,
            description: "Conditions on the trigger that must be met for this skill to be used." + mdSeeAlso("Metaskills#triggerconditions"),
        },
        Cooldown: {
            schema: new YNum(0, undefined, true),
            required: false,
            description: "The cooldown of this skill in seconds." + mdSeeAlso("Metaskills#cooldown"),
        },
        OnCooldownSkill: {
            schema: new YString(),
            required: false,
            description: "The skill to use when this skill is on cooldown." + mdSeeAlso("Metaskills#oncooldownskill"),
        },
        Skills: {
            schema: new YMythicSkillArr(new YMythicSkill(false), new Resolver(doc, cached)),
            required: false,
            description: "The mechanics that are run when this skill is used." + mdSeeAlso("Metaskills#skills"),
        },
    }).setName("mythic_skill_map"),
);
