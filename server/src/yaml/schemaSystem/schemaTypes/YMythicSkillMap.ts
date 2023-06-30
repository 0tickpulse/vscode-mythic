import { stripIndentation } from "tick-ts-utils";
import { Node, isMap } from "yaml";
import { CustomPosition, CustomRange } from "../../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { CachedMythicSkill } from "../../../mythicModels.js";
import { globalData } from "../../../documentManager.js";
import { SemanticTokenTypes } from "vscode-languageserver";
import { Highlight } from "../../../colors.js";
import { YMap } from "./YMap.js";
import { SchemaValidationError } from "../schemaTypes.js";

export class YMythicSkillMap extends YMap {
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
    override getDescription() {
        return "a map in which values are each a skill";
    }
    override preValidate(doc: DocumentInfo, value: Node): void {
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
                globalData.mythic.skills.add(new CachedMythicSkill(doc, [keyNode, item.value as Node], declarationRange, key));
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
    override postValidate(doc: DocumentInfo, value: Node): void {
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
