import { Optional, stripIndentation } from "tick-ts-utils";
import { SemanticTokenTypes } from "vscode-languageserver";
import { Node, isCollection, isMap } from "yaml";
import { Highlight } from "../../../colors.js";
import { globalData } from "../../../documentManager.js";
import { CachedMythicSkill } from "../../../mythicModels.js";
import { Resolver } from "../../../mythicParser/resolver.js";
import { CustomPosition, CustomRange } from "../../../utils/positionsAndRanges.js";
import { mdSeeAlso } from "../../../utils/utils.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { SchemaValidationError, YArr, YMap, YMythicCondition, YMythicSkill, YNum, YObj, YString, YamlSchema } from "../schemaTypes.js";
import {} from "./mythicSkill.js";
import { dbg } from "../../../utils/logging.js";

const mythicSkill = (cached: CachedMythicSkill) =>
    new YObj({
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
            schema: new YMythicSkillArr(new YMythicSkill(false), new Resolver(cached.doc, cached)),
            required: false,
            description: "The mechanics that are run when this skill is used." + mdSeeAlso("Metaskills#skills"),
        },
    });

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
    constructor(public valueFn: (cached: CachedMythicSkill) => YObj) {
        super();
    }
    override getDescription() {
        return "a map in which values are each a skill";
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value)];
        }

        const errors: SchemaValidationError[] = [];

        const { items } = value;
        const keys: Set<string> = new Set();
        for (const item of items) {
            let cachedSkill: CachedMythicSkill | undefined = undefined;
            if (item.key !== null) {
                const keyNode = item.key as Node;
                const key = keyNode.toString();
                if (keys.has(key)) {
                    errors.push(new SchemaValidationError(this, `Duplicate key ${key}!`, doc, keyNode));
                } else {
                    const declarationRange = CustomRange.fromYamlRange(doc.lineLengths, keyNode.range!);
                    cachedSkill = new CachedMythicSkill(doc, [keyNode, item.value as Node], declarationRange, key);
                    globalData.mythic.skills.add(cachedSkill);
                    doc.addHover({
                        range: declarationRange,
                        contents: YMythicSkillMap.generateKeyHover(key),
                    });
                    doc.addHighlight(new Highlight(declarationRange, SemanticTokenTypes.function, ["declaration"]));
                }
            }
            if (cachedSkill) {
                const values = this.valueFn(cachedSkill);
                const error = values.runPreValidation(doc, item.value as Node);
                errors.push(...error);
            }
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
            const key = item.key as Node;
            const cachedSkill = doc.cachedMythicSkills.find((s) => s.name === key.toString());
            if (cachedSkill) {
                const values = this.valueFn(cachedSkill);
                const error = values.runPostValidation(doc, item.value as Node);
                errors.push(...error);
            }
        }
        return errors;
    }
    override autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        isMap(value) &&
            value.items.forEach((item) => {
                const key = item.key as Node;
                const cachedSkill = doc.cachedMythicSkills.find((s) => s.name === key.toString());
                if (cachedSkill) {
                    const values = this.valueFn(cachedSkill);
                    values.autoComplete(doc, item.value as Node, cursor);
                }
            });
    }
    get rawTypeText() {
        return `mythic_skill_map`;
    }
}

export class YMythicSkillArr extends YamlSchema {
    constructor(public itemSchema: YMythicSkill, public resolver: Resolver) {
        super();
    }
    setItemSchema(itemSchema: YMythicSkill) {
        this.itemSchema = itemSchema;
        return this;
    }
    override getDescription() {
        return `an array of mythic skills.'`;
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (!isCollection(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value)];
        }

        const errors: SchemaValidationError[] = [];

        value.items.forEach((item) => {
            const innerErrors = this.itemSchema.runPreValidation(doc, item as Node);
            errors.push(...innerErrors);
        });

        return errors;
    }
    override postValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        // traverse children
        const errors: SchemaValidationError[] = [];
        this.itemSchema.resolver = Optional.of(this.resolver);
        isCollection(value) &&
            value.items.forEach((item) => {
                const innerErrors = this.itemSchema.runPostValidation(doc, item as Node);
                errors.push(...innerErrors);
            });
        return errors;
    }
    override autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        isCollection(value) &&
            value.items.forEach((item) => {
                this.itemSchema.autoComplete(doc, item as Node, cursor);
            });
    }
    get rawTypeText() {
        return `array(${this.itemSchema.typeText})`;
    }
}
export const mythicSkillSchema: YamlSchema = new YMythicSkillMap(mythicSkill);
