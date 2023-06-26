import { Optional, stripIndentation } from "tick-ts-utils";
import { Node, isCollection, isMap, isScalar } from "yaml";
import { getAst } from "../../mythicParser/main.js";
import { Resolver } from "../../mythicParser/resolver.js";
import { CustomRange } from "../../utils/positionsAndRanges.js";
import { getClosestTo } from "../../utils/utils.js";
import { DocumentInfo } from "../parser/parser.js";
import { CachedMythicSkill } from "../../mythicModels.js";
import { globalData } from "../../documentManager.js";
import { Hover } from "vscode-languageserver";

export class SchemaValidationError {
    message: string;
    constructor(
        public expectedType: YamlSchema,
        message: string,
        public source: string,
        public node: Node,
        public range = node !== null ? CustomRange.fromYamlRange(source, node.range!) : null,
    ) {
        this.message = message; // TODO - Format the message better
    }
}

/**
 * A schema that can be used to validate and modify a YAML node.
 */
export abstract class YamlSchema {
    name?: string;
    abstract getDescription(): string;
    /**
     * Runs before validation.
     *
     * @param doc   The document to validate and modify
     * @param value The value to validate and modify
     */
    preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        return [];
    }
    /**
     * Performs validation on the given value, returning a list of errors.
     * This additionally modifies the document, adding things like hover text.
     *
     * @param doc   The document to validate and modify
     * @param value The value to validate and modify
     */
    postValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        return [];
    }
    get rawTypeText() {
        return "unknown";
    }
    get typeText() {
        return this.name ?? this.rawTypeText;
    }
    setName(name: string) {
        this.name = name;
        return this;
    }
}

export class YamlSchemaString extends YamlSchema {
    literal: Optional<string>;
    constructor(literal?: string) {
        super();
        this.literal = Optional.of(literal);
    }
    setLiteral(literal: string) {
        this.literal = Optional.of(literal);
        return this;
    }
    removeLiteral() {
        this.literal = Optional.empty();
        return this;
    }
    override getDescription() {
        return this.literal.map((literal) => `"${literal}"`).otherwise("a string");
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value)];
        }
        return [];
    }
    get rawTypeText() {
        return "string";
    }
}
export class YamlSchemaNumber extends YamlSchema {
    constructor(public lowerBound?: number, public upperBound?: number, public isInteger?: boolean) {
        super();
        this.lowerBound = lowerBound;
        this.upperBound = upperBound;
        this.isInteger = isInteger;
    }
    setLowerBound(lowerBound: number) {
        this.lowerBound = lowerBound;
        return this;
    }
    setUpperBound(upperBound: number) {
        this.upperBound = upperBound;
        return this;
    }
    setIsInteger(isInteger: boolean) {
        this.isInteger = isInteger;
        return this;
    }
    override getDescription() {
        const type = this.isInteger ? "an integer" : "a number";
        if (this.lowerBound !== undefined && this.upperBound === undefined) {
            return `${type} greater than ${this.lowerBound}`;
        }
        if (this.lowerBound === undefined && this.upperBound !== undefined) {
            return `${type} less than ${this.upperBound}`;
        }
        if (this.lowerBound !== undefined && this.upperBound !== undefined) {
            return `${type} between ${this.lowerBound} and ${this.upperBound}`;
        }
        return type;
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        const range = value.range && CustomRange.fromYamlRange(source, value.range);
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value, range)];
        }
        const num = Number(value.value);
        if (isNaN(num)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value, range)];
        }
        if (this.lowerBound !== undefined && num < this.lowerBound) {
            return [new SchemaValidationError(this, `Expected a number greater than ${this.lowerBound}!`, source, value, range)];
        }
        if (this.upperBound !== undefined && num > this.upperBound) {
            return [new SchemaValidationError(this, `Expected a number less than ${this.upperBound}!`, source, value, range)];
        }
        if (this.isInteger && !Number.isInteger(num)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value, range)];
        }
        return [];
    }
    get rawTypeText() {
        let res = this.isInteger ? "integer" : "number";
        if (this.lowerBound !== undefined || this.upperBound !== undefined) {
            res += `(${this.lowerBound?.toString() ?? "-∞"}, ${this.upperBound?.toString() ?? "∞"})`;
        }
        return res;
    }
}
export class YamlSchemaBoolean extends YamlSchema {
    override getDescription() {
        return "a boolean";
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value)];
        }
        if (value.value !== "true" && value.value !== "false") {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value)];
        }
        return [];
    }
    get rawTypeText() {
        return "boolean";
    }
}
export class YamlSchemaArray extends YamlSchema {
    constructor(public itemSchema: YamlSchema) {
        super();
    }
    setItemSchema(itemSchema: YamlSchema) {
        this.itemSchema = itemSchema;
        return this;
    }
    override getDescription() {
        return `an array in which items are each '${this.itemSchema.getDescription()}'`;
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (this.itemSchema instanceof YamlSchemaMythicSkill) {
            this.itemSchema.resolver = Optional.of(new Resolver());
        }

        const source = doc.base.getText();
        if (!isCollection(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value)];
        }

        const errors: SchemaValidationError[] = [];

        value.items.forEach((item) => {
            const innerErrors = this.itemSchema.preValidate(doc, item as Node);
            errors.push(...innerErrors);
        });

        return errors;
    }
    override postValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        // traverse children
        const errors: SchemaValidationError[] = [];
        isCollection(value) &&
            value.items.forEach((item) => {
                const innerErrors = this.itemSchema.postValidate(doc, item as Node);
                errors.push(...innerErrors);
            });
        return errors;
    }
    get rawTypeText() {
        return `array(${this.itemSchema.typeText})`;
    }
}
export class YamlSchemaTuple extends YamlSchema {
    constructor(public itemSchema: YamlSchema[] = []) {
        super();
    }
    override getDescription() {
        return `a tuple in which items are: '${this.itemSchema.map((schema) => schema.getDescription()).join("', '")}'`;
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isCollection(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value)];
        }
        // check length
        if (value.items.length !== this.itemSchema.length) {
            return [
                new SchemaValidationError(
                    this,
                    `Expected a tuple with ${this.itemSchema.length} items, but got ${value.items.length}!`,
                    source,
                    value,
                ),
            ];
        }
        // check items
        const errors: SchemaValidationError[] = [];
        for (let i = 0; i < this.itemSchema.length; i++) {
            const innerErrors = this.itemSchema[i].preValidate(doc, value.items[i] as Node);

            errors.push(...innerErrors);
        }
        return errors;
    }
    setItemSchema(itemSchema: YamlSchema[]) {
        this.itemSchema = itemSchema;
        return this;
    }
    get rawTypeText() {
        return `tuple(${this.itemSchema.map((schema) => schema.typeText).join(", ")})`;
    }
}
export class YamlSchemaObject extends YamlSchema {
    constructor(
        public properties: Record<
            string,
            {
                schema: YamlSchema;
                required?: boolean;
                description?: string;
            }
        > = {},
    ) {
        super();
    }
    setProperty(name: string, schema: YamlSchema, required?: boolean, description?: string) {
        this.properties[name] = { schema, required, description };
        return this;
    }
    removeProperty(name: string) {
        delete this.properties[name];
        return this;
    }
    override getDescription() {
        return `an object in which properties are: '${Object.entries(this.properties)
            .map(([key, { schema, required }]) => `${key}: ${schema.getDescription()}${required ? " (required)" : ""}`)
            .join("', '")}'`;
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value)];
        }

        const { items } = value;

        const errors: SchemaValidationError[] = [];

        // iterate over schema
        for (const [key, { schema, required, description }] of Object.entries(this.properties)) {
            const item = items.find((i) => {
                if (i.key === null) {
                    return false;
                }
                return (i.key as any).value === key;
            }) as { key: Node; value: Node } | undefined;
            if (item) {
                if (item.value !== null) {
                    const error = schema.preValidate(doc, item.value);
                    errors.push(...error);
                }
                if (item.key !== null && description) {
                    const range = item.key.range;
                    if (range) {
                        const customRange = CustomRange.fromYamlRange(source, range);
                        customRange &&
                            doc.addHover({
                                range: customRange,
                                contents: stripIndentation`Property \`${key}\`: \`${schema.typeText}\`

                                ${description}`,
                            });
                    }
                }
            } else if (required) {
                return [new SchemaValidationError(this, `Missing required property "${key}"!`, source, value)];
            }
        }

        // iterate over object
        for (const item of items) {
            if (item.key === null) {
                continue;
            }
            const key = (item.key as any).value;
            const range = (item.key as Node).range;
            const customRange = range ? CustomRange.fromYamlRange(source, range) : undefined;
            if (!this.properties[key]) {
                const closest = getClosestTo(key, Object.keys(this.properties));
                let message = `Unknown property "${key}"!`;
                if (closest) {
                    message += ` Did you mean "${closest}"?`;
                }
                return [new SchemaValidationError(this, message, source, value, customRange)];
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
            if (item.key !== null) {
                const key = (item.key as any).value;
                const schema = this.properties[key]?.schema;
                if (!schema) {
                    continue;
                }
                const innerErrors = schema.postValidate(doc, item.value as Node);
                errors.push(...innerErrors);
            }
        }
        return errors;
    }
    get rawTypeText() {
        return `object(${Object.entries(this.properties)
            .map(([key, { schema }]) => `${key}: ${schema.typeText}`)
            .join(", ")})`;
    }
}
export class YamlSchemaMap extends YamlSchema {
    constructor(public values: YamlSchema) {
        super();
    }
    setValues(values: YamlSchema) {
        this.values = values;
        return this;
    }
    override getDescription() {
        return `a map in which values are each '${this.values.getDescription()}'`;
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value)];
        }

        const errors: SchemaValidationError[] = [];

        const { items } = value;
        for (const item of items) {
            const error = this.values.preValidate(doc, item.value as Node);
            errors.push(...error);
        }

        return errors;
    }
    override postValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        // traverse children
        const errors: SchemaValidationError[] = [];
        isMap(value) &&
            value.items.forEach((item) => {
                const innerErrors = this.values.postValidate(doc, item.value as Node);
                errors.push(...innerErrors);
            });
        return errors;
    }
    get rawTypeText() {
        return `map(${this.values.typeText})`;
    }
}

export class YamlSchemaMythicSkillMap extends YamlSchemaMap {
    static generateKeyHover(name: string) {
        return stripIndentation`# MetaSkill: \`${name}\`
        Skills are a core feature of MythicMobs, allowing users to create custom abilities for their mobs or items that are triggered under various circumstances and with varying conditions.
        A metaskill is a list of skills that can be called using a [🔗 Meta Mechanic](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Mechanics#advancedmeta-mechanics).

        To declare a metaskill, use the following syntax:
        ` + `
        \`\`\`mythicyaml
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
        `.split("\n").map((line) => line.substring(8)).join("\n") + stripIndentation`
        ## See Also

        * [🔗 Wiki: Skills](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Skills)
        * [🔗 Wiki: Metaskills](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Metaskills)
        `;
    }
    override getDescription() {
        return "a map in which values are each a skill";
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value)];
        }

        const errors: SchemaValidationError[] = [];

        const { items } = value;
        for (const item of items) {
            if (item.key !== null) {
                const key = (item.key as Node).toString();
                const declarationRange = CustomRange.fromYamlRange(source, (item.key as Node).range!);
                const description = (item.key as Node).commentBefore ?? undefined;
                globalData.mythic.skills.add(new CachedMythicSkill(doc, [item.key as Node, item.value as Node], declarationRange, key, description));
                doc.addHover({
                    range: declarationRange,
                    contents: YamlSchemaMythicSkillMap.generateKeyHover(key),
                })
            }
            const error = this.values.preValidate(doc, item.value as Node);
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
            const error = this.values.postValidate(doc, item.value as Node);
            errors.push(...error);
        }
        return errors;
    }
    get rawTypeText() {
        return `map(${this.values.typeText})`;
    }
}

export class YamlSchemaUnion extends YamlSchema {
    items: readonly YamlSchema[] = [];
    constructor(...items: readonly YamlSchema[]) {
        super();
        this.items = items;
    }
    add(...items: readonly YamlSchema[]) {
        this.items = [...this.items, ...items];
    }
    override getDescription() {
        return `one of these: '${this.items.map((item) => item.getDescription()).join("', '")}'`;
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        for (const item of this.items) {
            const error = item.preValidate(doc, value);
            if (error.length === 0) {
                return [];
            }
        }
        return [new SchemaValidationError(this, `Expected ${this.getDescription()}`, source, value)];
    }
    get rawTypeText() {
        return `${this.items.map((item) => item.typeText).join(" | ")}`;
    }
}
export class YamlSchemaMythicSkill extends YamlSchema {
    resolver: Optional<Resolver> = Optional.empty();
    constructor(public supportsTriggers = true) {
        super();
    }
    override getDescription() {
        return "a skill" + (this.supportsTriggers ? "" : " that does not support triggers.");
    }
    override postValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, source, value)];
        }

        let rangeOffset = value.range!;
        if (value.type === "QUOTE_DOUBLE" || value.type === "QUOTE_SINGLE") {
            rangeOffset = [rangeOffset[0] + 1, rangeOffset[1] - 1, rangeOffset[2]];
        }
        const customRangeOffset = CustomRange.fromYamlRange(source, rangeOffset);

        const skillLine = source
            .substring(rangeOffset[0], rangeOffset[1])
            .split("\n")
            .map((line, index) => {
                if (index !== 0) {
                    return line.substring(customRangeOffset.start.character);
                }
                return line;
            })
            .join("\n");

        const ast = getAst(skillLine);
        if (ast.hasErrors()) {
            return ast.errors!.map(
                (error) => new SchemaValidationError(this, error.message, source, value, error.range.addOffset(source, rangeOffset[0])),
            );
        }

        this.resolver.ifPresent((r) => {
            r.setAst(ast.skillLine!);
            r.resolveWithDoc(doc, rangeOffset[0]);
        });

        return [];
    }
    get rawTypeText() {
        return "mythicSkill";
    }
}
// TODO
export class YamlSchemaMythicItem extends YamlSchema {
    constructor() {
        super();
    }
    override getDescription() {
        return "an item";
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        return [];
    }
    get rawTypeText() {
        return "item";
    }
}
// TODO
export class YamlSchemaMythicCondition extends YamlSchema {
    constructor() {
        super();
    }
    override getDescription() {
        return "a condition";
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        return [];
    }
    get rawTypeText() {
        return "condition";
    }
}
