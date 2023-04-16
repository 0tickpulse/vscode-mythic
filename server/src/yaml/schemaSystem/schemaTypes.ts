import { Optional, stripIndentation } from "tick-ts-utils";
import { Node, isCollection, isMap, isScalar } from "yaml";
import { CustomPosition, CustomRange } from "../../utils/positionsAndRanges.js";
import { getAst } from "../../mythicParser/main.js";
import { DocumentInfo } from "../parser/parser.js";
import { generateHover, getAllMechanicsAndAliases, getHolderFromName } from "../../minecraftData/services.js";
import { getClosestTo } from "../../utils/utils.js";
import { Resolver } from "../../mythicParser/resolver.js";

export class SchemaValidationError {
    constructor(
        public message: string,
        public source: string,
        public node: Node,
        public range = node !== null ? CustomRange.fromYamlRange(source, node.range!) : null,
    ) {}
}

/**
 * A schema that can be used to validate and modify a YAML node.
 */
export abstract class YamlSchema {
    abstract getDescription(): string;
    /**
     * Performs validation on the given value, returning a list of errors.
     * This additionally modifies the document, adding things like hover text.
     *
     * @param doc   The document to validate and modify
     * @param value The value to validate and modify
     */
    abstract validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[];
    /**
     * Like validateAndModify, but also times the execution. Used for debugging.
     *
     * @param doc   The document to validate and modify
     * @param value The value to validate and modify
     */
    validateAndModifyTimed(doc: DocumentInfo, value: Node) {
        console.time(`validateAndModify (${this.getTypeText()})`);
        const errors = this.validateAndModify(doc, value);
        console.timeEnd(`validateAndModify (${this.getTypeText()})`);
        return errors;
    }
    getTypeText() {
        return "any";
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return [new SchemaValidationError("Expected a string!", source, value)];
        }
        return [];
    }
    getTypeText() {
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return [new SchemaValidationError("Expected a number!", source, value)];
        }
        if (isNaN(Number(value.value))) {
            return [new SchemaValidationError("Expected a number!", source, value)];
        }
        return [];
    }
    getTypeText() {
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return [new SchemaValidationError("Expected a boolean!", source, value)];
        }
        if (value.value !== "true" && value.value !== "false") {
            return [new SchemaValidationError("Expected a boolean!", source, value)];
        }
        return [];
    }
    getTypeText() {
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        if (this.itemSchema instanceof YamlSchemaMythicSkill) {
            this.itemSchema.resolver = Optional.of(new Resolver());
        }

        const source = doc.base.getText();
        if (!isCollection(value)) {
            return [new SchemaValidationError("Expected an array!", source, value)];
        }

        const errors: SchemaValidationError[] = [];

        value.items.forEach((item) => {
            const innerErrors = this.itemSchema.validateAndModify(doc, item as Node);
            errors.push(...innerErrors);
        });

        return errors;
    }
    getTypeText() {
        return `array(${this.itemSchema.getTypeText()})`;
    }
}
export class YamlSchemaTuple extends YamlSchema {
    constructor(public itemSchema: YamlSchema[] = []) {
        super();
    }
    override getDescription() {
        return `a tuple in which items are: '${this.itemSchema.map((schema) => schema.getDescription()).join("', '")}'`;
    }
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isCollection(value)) {
            return [new SchemaValidationError("Expected a tuple!", source, value)];
        }
        // check length
        if (value.items.length !== this.itemSchema.length) {
            return [
                new SchemaValidationError(`Expected a tuple with ${this.itemSchema.length} items, but got ${value.items.length}!`, source, value),
            ];
        }
        // check items
        const errors: SchemaValidationError[] = [];
        for (let i = 0; i < this.itemSchema.length; i++) {
            const innerErrors = this.itemSchema[i].validateAndModify(doc, value.items[i] as Node);

            errors.push(...innerErrors);
        }
        return errors;
    }
    setItemSchema(itemSchema: YamlSchema[]) {
        this.itemSchema = itemSchema;
        return this;
    }
    getTypeText() {
        return `tuple(${this.itemSchema.map((schema) => schema.getTypeText()).join(", ")})`;
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isMap(value)) {
            return [new SchemaValidationError("Expected an object!", source, value)];
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
                    const error = schema.validateAndModify(doc, item.value);
                    errors.push(...error);
                }
                if (item.key !== null && description) {
                    const range = item.key.range;
                    if (range) {
                        const customRange = CustomRange.fromYamlRange(source, range);
                        customRange &&
                            doc.addHover({
                                range: customRange,
                                contents: stripIndentation`Property \`${key}\`: \`${schema.getTypeText()}\`

                                ${description}`,
                            });
                    }
                }
            } else if (required) {
                return [new SchemaValidationError(`Missing required property "${key}"!`, source, value)];
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
                return [new SchemaValidationError(message, source, value, customRange)];
            }
        }

        return errors;
    }
    getTypeText() {
        return `object(${Object.entries(this.properties)
            .map(([key, { schema }]) => `"${key}": ${schema.getTypeText()}`)
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isMap(value)) {
            return [new SchemaValidationError("Expected a map!", source, value)];
        }

        const errors: SchemaValidationError[] = [];

        const { items } = value;
        for (const item of items) {
            const error = this.values.validateAndModify(doc, item.value as Node);
            errors.push(...error);
        }

        return errors;
    }
    getTypeText() {
        return `map(${this.values.getTypeText()})`;
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        for (const item of this.items) {
            const error = item.validateAndModify(doc, value);
            if (error.length === 0) {
                return [];
            }
        }
        return [new SchemaValidationError(`Expected ${this.getDescription()}`, source, value)];
    }
    getTypeText() {
        return `${this.items.map((item) => item.getTypeText()).join(" | ")}`;
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return [new SchemaValidationError("Expected a skill!", source, value)];
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
            return ast.errors!.map((error) => new SchemaValidationError(error.message, source, value, error.range.addOffset(source, rangeOffset[0])));
        }

        this.resolver.ifPresent((r) => {
            r.setAst(ast.skillLine!);
            r.resolveWithDoc(doc, rangeOffset[0]);
        });

        return [];
    }
    getTypeText() {
        return "skill";
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        return [];
    }
    getTypeText() {
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
    override validateAndModify(doc: DocumentInfo, value: Node): SchemaValidationError[] {
        const source = doc.base.getText();
        return [];
    }
    getTypeText() {
        return "condition";
    }
}
