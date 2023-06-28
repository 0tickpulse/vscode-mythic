import { Optional, stripIndentation } from "tick-ts-utils";
import { Node, Scalar, isCollection, isMap, isScalar } from "yaml";
import { getAst } from "../../mythicParser/main.js";
import { Resolver } from "../../mythicParser/resolver.js";
import { CustomPosition, CustomRange } from "../../utils/positionsAndRanges.js";
import { filterMap, getClosestTo } from "../../utils/utils.js";
import { DocumentInfo } from "../parser/documentInfo.js";
import { CachedMythicSkill } from "../../mythicModels.js";
import { globalData } from "../../documentManager.js";
import { CompletionItem, CompletionItemKind, Hover, SemanticTokenTypes } from "vscode-languageserver";
import { Highlight } from "../../colors.js";
import { server } from "../../index.js";
import { cursorValidInRange, scalarValue } from "./schemaUtils.js";

export class SchemaValidationError {
    message: string;
    constructor(
        public expectedType: YamlSchema,
        message: string,
        public doc: DocumentInfo,
        public node: Node | null,
        public range = node !== null ? CustomRange.fromYamlRange(doc.lineLengths, node.range!) : null,
    ) {
        this.message = message + `\n\nGot: ${node?.toString()}`; // TODO - Format the message better
    }
}

/**
 * The root schema.
 */
export class YamlSchema {
    /**
     * The name of this schema, if any.
     * This name is similar to a type alias, and will be displayed in messages.
     * Recommended for complex schemas.
     */
    name?: string;
    getDescription(): string {
        return "unknown";
    }
    additionalPreValidators: ((doc: DocumentInfo, value: Node) => SchemaValidationError[])[] = [];
    additionalPostValidators: ((doc: DocumentInfo, value: Node) => SchemaValidationError[])[] = [];
    onPreValidation(additionalValidator: (doc: DocumentInfo, value: Node) => SchemaValidationError[]) {
        this.additionalPreValidators.push(additionalValidator);
        return this;
    }
    onPostValidation(additionalPostValidator: (doc: DocumentInfo, value: Node) => SchemaValidationError[]) {
        this.additionalPostValidators.push(additionalPostValidator);
        return this;
    }
    /**
     * The first validation step, which should be used for simple validation of types, values, etc.
     * This can be used to index things to be used in the second validation step.
     *
     * @param doc   The document to validate and modify
     * @param value The value to validate and modify
     */
    runPreValidation(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const errors: SchemaValidationError[] = [];
        errors.push(...this.preValidate(doc, value));
        for (const preValidator of this.additionalPreValidators) {
            const innerErrors = preValidator(doc, value);
            errors.push(...innerErrors);
        }
        return errors;
    }
    protected preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        return [];
    }
    /**
     * The second validation step, which should be used for more complex validation.
     * Note that the second validation step only runs on nodes that pass the first validation step.
     * Also note that the second validation step does not run on all files in the workspace on launch.
     * This is contrary to the first validation step, and is intentionally done to improve performance.
     *
     * @param doc   The document to validate and modify
     * @param value The value to validate and modify
     */
    runPostValidation(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const errors: SchemaValidationError[] = [];
        errors.push(...this.postValidate(doc, value));
        for (const postValidator of this.additionalPostValidators) {
            const innerErrors = postValidator(doc, value);
            errors.push(...innerErrors);
        }
        return errors;
    }
    autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        return;
    }
    protected postValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        return [];
    }
    /**
     * The raw description of this schema, as a string.
     * Type text should be a **complete** description of the type, and should be legible, specific, and concise.
     */
    get rawTypeText() {
        return "unknown";
    }
    /**
     * The type of this schema, as a string.
     * Will use {@link name} if it exists, otherwise {@link rawTypeText}.
     */
    get typeText() {
        return this.name ?? this.rawTypeText;
    }
    setName(name: string) {
        this.name = name;
        return this;
    }
}

export class YString extends YamlSchema {
    literal: Optional<string>;
    completionItem: Optional<CompletionItem>;
    constructor(literal?: string, public caseSensitive = true) {
        super();
        this.literal = Optional.of(literal);
        this.completionItem = this.literal.map((literal) => ({
            label: literal,
            kind: CompletionItemKind.Value,
            insertText: literal,
        }));
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
    override autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        console.log(`[YString] ${this.literal}`);
        if (!isScalar(value)) {
            return;
        }
        const range = CustomRange.fromYamlRange(doc.lineLengths, value.range!);
        if (cursor !== undefined && cursorValidInRange(doc, range, cursor) && this.completionItem.isPresent()) {
            // const start = scalarValue(value);
            // const isValid = start.trim() === "" || this.literal.get().toLowerCase().startsWith(start.toLowerCase());
            // console.table({
            //     start,
            //     literal: this.literal.get(),
            //     isValid,
            // });
            doc.autoCompletions.push(this.completionItem.get());
        }
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value)];
        }
        if (this.literal.isPresent() && !this.#check(scalarValue(value), this.literal.get())) {
            return [new SchemaValidationError(this, `Expected value "${this.literal.get()}"!\nRaw type: ${this.rawTypeText}`, doc, value)];
        }
        return [];
    }
    #check(value1: string, value2: string) {
        return this.caseSensitive ? value1 === value2 : value1.toLowerCase() === value2.toLowerCase();
    }
    get rawTypeText() {
        return this.literal.map((literal) => `"${literal}"`).otherwise("string");
    }
}
export class YNum extends YamlSchema {
    constructor(
        public lowerBound?: number,
        public upperBound?: number,
        public lowerBoundInclusive = true,
        public upperBoundInclusive = true,
        public isInteger?: boolean,
    ) {
        super();
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
        const range = value.range && CustomRange.fromYamlRange(doc.lineLengths, value.range);
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value, range)];
        }
        const num = Number(value.value);
        if (isNaN(num)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value, range)];
        }
        if (this.lowerBound !== undefined && (this.lowerBoundInclusive ? num < this.lowerBound : num <= this.lowerBound)) {
            return [
                new SchemaValidationError(
                    this,
                    `Expected a number greater than ${this.lowerBoundInclusive ? "or equal to " : ""}${this.lowerBound}!`,
                    doc,
                    value,
                    range,
                ),
            ];
        }
        if (this.upperBound !== undefined && (this.upperBoundInclusive ? num > this.upperBound : num >= this.upperBound)) {
            return [
                new SchemaValidationError(
                    this,
                    `Expected a number less than ${this.upperBoundInclusive ? "or equal to " : ""}${this.upperBound}!`,
                    doc,
                    value,
                    range,
                ),
            ];
        }
        if (this.isInteger && !Number.isInteger(num)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value, range)];
        }
        return [];
    }
    get rawTypeText() {
        let res = this.isInteger ? "integer" : "number";
        if (this.lowerBound !== undefined || this.upperBound !== undefined) {
            res += `(${this.lowerBound?.toString() ?? "-∞"}${this.lowerBoundInclusive ? "=" : ""}..${this.upperBoundInclusive ? "=" : ""}${
                this.upperBound?.toString() ?? "∞"
            })`;
        }
        return res;
    }
}
export class YBool extends YamlSchema {
    override getDescription() {
        return "a boolean";
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value)];
        }
        if (scalarValue(value) !== "true" && scalarValue(value) !== "false") {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value)];
        }
        return [];
    }
    get rawTypeText() {
        return "bool";
    }
}
export class YArr extends YamlSchema {
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
        if (this.itemSchema instanceof YMythicSkill) {
            this.itemSchema.resolver = Optional.of(new Resolver());
        }

        if (!isCollection(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value)];
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
export class YTuple extends YamlSchema {
    constructor(public itemSchema: YamlSchema[] = []) {
        super();
    }
    override getDescription() {
        return `a tuple in which items are: '${this.itemSchema.map((schema) => schema.getDescription()).join("', '")}'`;
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (!isCollection(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value)];
        }
        // check length
        if (value.items.length !== this.itemSchema.length) {
            return [
                new SchemaValidationError(this, `Expected a tuple with ${this.itemSchema.length} items, but got ${value.items.length}!`, doc, value),
            ];
        }
        // check items
        const errors: SchemaValidationError[] = [];
        for (let i = 0; i < this.itemSchema.length; i++) {
            const innerErrors = this.itemSchema[i].runPreValidation(doc, value.items[i] as Node);

            errors.push(...innerErrors);
        }
        return errors;
    }
    setItemSchema(itemSchema: YamlSchema[]) {
        this.itemSchema = itemSchema;
        return this;
    }
    override autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        isCollection(value) &&
            value.items.forEach((item, index) => {
                this.itemSchema[index].autoComplete(doc, item as Node, cursor);
            });
    }
    get rawTypeText() {
        return `tuple(${this.itemSchema.map((schema) => schema.typeText).join(", ")})`;
    }
}
export class YObj extends YamlSchema {
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
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value)];
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
                const error = schema.runPreValidation(doc, item.value);
                errors.push(...error);
                if (item.key !== null && description) {
                    const range = item.key.range;
                    if (range) {
                        const customRange = CustomRange.fromYamlRange(doc.lineLengths, range);
                        customRange &&
                            doc.addHover({
                                range: customRange,
                                contents: stripIndentation`Property \`${this.name ?? ""}${key}\`: \`${schema.typeText}\`

                                ${description}`,
                            });
                    }
                }
            } else if (required) {
                errors.push(new SchemaValidationError(this, `Missing required property "${key}"!`, doc, value));
            }
        }

        // iterate over object
        for (const item of items) {
            if (item.key === null) {
                continue;
            }
            const key = (item.key as Scalar).toString();
            const range = (item.key as Node).range;
            const customRange = range ? CustomRange.fromYamlRange(doc.lineLengths, range) : undefined;
            if (!this.properties[key]) {
                const closest = getClosestTo(key, Object.keys(this.properties));
                let message = `Unknown property "${key}"!`;
                if (closest) {
                    message += ` Did you mean "${closest}"?`;
                }
                errors.push(new SchemaValidationError(this, message, doc, value, customRange));
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
                const innerErrors = schema.runPostValidation(doc, item.value as Node);
                errors.push(...innerErrors);
            }
        }
        return errors;
    }
    override autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        if (!isMap(value)) {
            return;
        }
        const { items } = value;
        for (const item of items) {
            if (item.key === null) {
                continue;
            }
            const key = (item.key as any).value;
            const schema = this.properties[key]?.schema;
            if (!schema) {
                continue;
            }
            schema.autoComplete(doc, item.value as Node, cursor);
        }
    }
    get rawTypeText() {
        return `object(${Object.entries(this.properties)
            .map(([key, { schema }]) => `${key}: ${schema.typeText}`)
            .join(", ")})`;
    }
}
export class YMap extends YamlSchema {
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
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value)];
        }

        const errors: SchemaValidationError[] = [];

        const { items } = value;
        for (const item of items) {
            const error = this.values.runPreValidation(doc, item.value as Node);
            errors.push(...error);
        }

        return errors;
    }
    override postValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        // traverse children
        const errors: SchemaValidationError[] = [];
        isMap(value) &&
            value.items.forEach((item) => {
                const innerErrors = this.values.runPostValidation(doc, item.value as Node);
                errors.push(...innerErrors);
            });
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
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value)];
        }

        const errors: SchemaValidationError[] = [];

        const { items } = value;
        for (const item of items) {
            if (item.key !== null) {
                const keyNode = item.key as Node;
                const key = keyNode.toString();
                const declarationRange = CustomRange.fromYamlRange(doc.lineLengths, keyNode.range!);
                const description = keyNode.commentBefore ?? undefined;
                globalData.mythic.skills.add(new CachedMythicSkill(doc, [item.key as Node, item.value as Node], declarationRange, key, description));
                doc.addHover({
                    range: declarationRange,
                    contents: YMythicSkillMap.generateKeyHover(key),
                });
                doc.addHighlight(new Highlight(declarationRange, SemanticTokenTypes.function));
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

export class YUnion extends YamlSchema {
    items: YamlSchema[] = [];
    constructor(...items: YamlSchema[]) {
        super();
        this.items = items;
    }
    static literals(...items: string[]) {
        return new YUnion(...items.map((item) => new YString(item)));
    }
    static nonCaseSensitiveLiterals(...items: string[]) {
        return new YUnion(...items.map((item) => new YString(item, false)));
    }
    add(...items: YamlSchema[]) {
        this.items = [...this.items, ...items];
    }
    override getDescription() {
        return `one of these: '${this.items.map((item) => item.getDescription()).join(", ")}'`;
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        for (const item of this.items) {
            const error = item.runPreValidation(doc, value);
            if (error.length === 0) {
                return [];
            }
        }
        const literals = filterMap(this.items, (item) => {
            if (item instanceof YString) {
                return item.literal;
            }
            return Optional.empty<string>();
        });
        const closest = isScalar(value) ? getClosestTo(scalarValue(value), literals) : undefined;
        return [
            new SchemaValidationError(this, `Expected ${this.typeText}!${closest !== undefined ? `\nDid you mean ${closest}?` : ""}`, doc, value),
        ];
    }
    override autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        for (const item of this.items) {
            item.autoComplete(doc, value, cursor);
        }
    }
    get rawTypeText() {
        return `${this.items.map((item) => item.typeText).join(" | ")}`;
    }
}
export class YMythicSkill extends YamlSchema {
    resolver: Optional<Resolver> = Optional.empty();
    constructor(public supportsTriggers = true) {
        super();
    }
    override getDescription() {
        return "a skill" + (this.supportsTriggers ? "" : " that does not support triggers.");
    }
    override postValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!\nRaw type: ${this.rawTypeText}`, doc, value)];
        }
        const { source, lineLengths } = doc;

        let rangeOffset = value.range!;
        if (value.type === "QUOTE_DOUBLE" || value.type === "QUOTE_SINGLE") {
            rangeOffset = [rangeOffset[0] + 1, rangeOffset[1] - 1, rangeOffset[2]];
        }
        const customRangeOffset = CustomRange.fromYamlRange(lineLengths, rangeOffset);

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
        const errors: SchemaValidationError[] = [];
        if (ast.hasErrors()) {
            errors.push(
                ...ast.errors!.map(
                    (error) => new SchemaValidationError(this, error.message, doc, value, error.range.addOffset(lineLengths, rangeOffset[0])),
                ),
            );
        }

        ast.skillLine &&
            this.resolver.ifPresent((r) => {
                r.setAst(ast.skillLine!);
                r.resolveWithDoc(doc, rangeOffset[0]);
            });

        const trigger = ast.skillLine?.trigger;
        if (trigger && !this.supportsTriggers) {
            errors.push(
                new SchemaValidationError(
                    this,
                    "Triggers cannot be used in meta-skills. They should only be used to activate meta-skills.",
                    doc,
                    value,
                    trigger.range.addOffset(lineLengths, rangeOffset[0]),
                ),
            );
        }

        return errors;
    }
    get rawTypeText() {
        return "mythicSkill";
    }
}
// TODO
export class YMythicItem extends YamlSchema {
    constructor() {
        super();
    }
    override getDescription() {
        return "an item";
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        return [];
    }
    get rawTypeText() {
        return "item";
    }
}
// TODO
export class YMythicCondition extends YamlSchema {
    constructor() {
        super();
    }
    override getDescription() {
        return "a condition";
    }
    override preValidate(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        return [];
    }
    get rawTypeText() {
        return "condition";
    }
}
