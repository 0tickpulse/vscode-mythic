import { Optional } from "tick-ts-utils";
import { Node, isCollection, isMap, isScalar } from "yaml";
import { CustomPosition, CustomRange } from "../../utils/positionsAndRanges.js";
import { getAst } from "../../mythicParser/main.js";
import { DocumentInfo } from "../parser/parser.js";
import { Highlighter } from "../../mythicParser/highlighter.js";
import { generateHover, getAllMechanicsAndAliases, getHolderFromName } from "../../minecraftData/services.js";
import { getClosestTo } from "../../utils/utils.js";

export class SchemaValidationError {
    constructor(
        public message: string,
        public source: string,
        public node: Node,
        public range = node !== null ? CustomRange.fromYamlRange(source, node.range!) : null,
    ) {}
}

export abstract class YamlSchema {
    abstract getDescription(): string;
    abstract validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]>;
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
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return Optional.of([new SchemaValidationError("Expected a string!", source, value)]);
        }
        return Optional.empty();
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
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return Optional.of([new SchemaValidationError("Expected a number!", source, value)]);
        }
        if (isNaN(Number(value.value))) {
            return Optional.of([new SchemaValidationError("Expected a number!", source, value)]);
        }
        return Optional.empty();
    }
}
export class YamlSchemaBoolean extends YamlSchema {
    override getDescription() {
        return "a boolean";
    }
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return Optional.of([new SchemaValidationError("Expected a boolean!", source, value)]);
        }
        if (value.value !== "true" && value.value !== "false") {
            return Optional.of([new SchemaValidationError("Expected a boolean!", source, value)]);
        }
        return Optional.empty();
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
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        if (!isCollection(value)) {
            return Optional.of([new SchemaValidationError("Expected an array!", source, value)]);
        }

        const errors: SchemaValidationError[] = [];

        for (const item of value.items) {
            const innerErrors = this.itemSchema.validateAndModify(doc, item as Node);
            if (innerErrors.isPresent()) {
                errors.push(...innerErrors.get());
            }
        }

        return errors.length > 0 ? Optional.of(errors) : Optional.empty();
    }
}
export class YamlSchemaTuple extends YamlSchema {
    constructor(public itemSchema: YamlSchema[] = []) {
        super();
    }
    override getDescription() {
        return `a tuple in which items are: '${this.itemSchema.map((schema) => schema.getDescription()).join("', '")}'`;
    }
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        if (!isCollection(value)) {
            return Optional.of([new SchemaValidationError("Expected a tuple!", source, value)]);
        }
        // check length
        if (value.items.length !== this.itemSchema.length) {
            return Optional.of([
                new SchemaValidationError(`Expected a tuple with ${this.itemSchema.length} items, but got ${value.items.length}!`, source, value),
            ]);
        }
        // check items
        for (let i = 0; i < this.itemSchema.length; i++) {
            const errors = this.itemSchema[i].validateAndModify(doc, value.items[i] as Node);
            if (errors.isPresent()) {
                return errors;
            }
        }
        return Optional.empty();
    }
    setItemSchema(itemSchema: YamlSchema[]) {
        this.itemSchema = itemSchema;
        return this;
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
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        if (!isMap(value)) {
            return Optional.of([new SchemaValidationError("Expected an object!", source, value)]);
        }

        const { items } = value;

        const errors: SchemaValidationError[] = [];

        // iterate over schema
        for (const [key, { schema, required }] of Object.entries(this.properties)) {
            const item = items.find((i) => {
                if (i.key === null) {
                    return false;
                }
                return (i.key as any).value === key;
            }) as { key: Node; value: Node } | undefined;
            if (item && item.value !== null) {
                const error = schema.validateAndModify(doc, item.value);
                if (error.isPresent()) {
                    errors.push(...error.get());
                }
            } else if (required) {
                return Optional.of([new SchemaValidationError(`Missing required property "${key}"!`, source, value)]);
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
                return Optional.of([new SchemaValidationError(message, source, value, customRange)]);
            }
        }

        return errors.length > 0 ? Optional.of(errors) : Optional.empty();
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
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        if (!isMap(value)) {
            return Optional.of([new SchemaValidationError("Expected a map!", source, value)]);
        }

        const errors: SchemaValidationError[] = [];

        const { items } = value;
        for (const item of items) {
            const error = this.values.validateAndModify(doc, item.value as Node);
            error.ifPresent((e) => errors.push(...e));
        }

        return errors.length > 0 ? Optional.of(errors) : Optional.empty();
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
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        for (const item of this.items) {
            const error = item.validateAndModify(doc, value);
            if (error.isEmpty()) {
                return Optional.empty();
            }
        }
        return Optional.of([new SchemaValidationError(`Expected ${this.getDescription()}`, source, value)]);
    }
}
export class YamlSchemaMythicSkill extends YamlSchema {
    constructor(public supportsTriggers = true) {
        super();
    }
    override getDescription() {
        return "a skill" + (this.supportsTriggers ? "" : " that does not support triggers.");
    }
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        if (!isScalar(value)) {
            return Optional.of([new SchemaValidationError("Expected a skill!", source, value)]);
        }

        let rangeOffset = CustomRange.fromYamlRange(source, value.range!);
        if (value.type === "QUOTE_DOUBLE" || value.type === "QUOTE_SINGLE") {
            rangeOffset = rangeOffset.addOffsetToStart(source, 1).addOffsetToEnd(source, -1);
        }
        const skillLine = rangeOffset
            .getFrom(source)
            .split("\n")
            .map((line, index) => {
                if (index !== 0) {
                    return line.substring(rangeOffset.start.character);
                }
                return line;
            })
            .join("\n");

        console.log(`Skillline: ${skillLine}`);

        const ast = getAst(skillLine);
        if (ast.hasErrors()) {
            return Optional.of(
                ast.errors!.map((error) => new SchemaValidationError(error.message, source, value, error.range.add(rangeOffset.start))),
            );
        }

        new Highlighter(ast.skillLine!).highlight(doc, rangeOffset);

        const mechanic = ast.getSkillLineOrThrow().mechanic;
        const mechanicName = mechanic.identifier.value();
        if (getAllMechanicsAndAliases().includes(mechanicName)) {
            doc.addHover({
                ...generateHover("mechanic", mechanicName, getHolderFromName("mechanic", mechanicName).get()),
                range: mechanic.getNameRange().add(rangeOffset.start),
            });
        }

        return Optional.empty();
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
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        return Optional.empty();
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
    override validateAndModify(doc: DocumentInfo, value: Node): Optional<SchemaValidationError[]> {
        const source = doc.base.getText();
        return Optional.empty();
    }
}
