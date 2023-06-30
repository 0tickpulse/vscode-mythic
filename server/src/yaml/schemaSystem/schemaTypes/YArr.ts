import { Optional } from "tick-ts-utils";
import { Node, isCollection } from "yaml";
import { Resolver } from "../../../mythicParser/resolver.js";
import { CustomPosition } from "../../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { YamlSchema, SchemaValidationError } from "../schemaTypes.js";
import { YMythicSkill } from "./YMythicSkill.js";

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
    override preValidate(doc: DocumentInfo, value: Node): void {
        if (this.itemSchema instanceof YMythicSkill) {
            this.itemSchema.resolver = Optional.of(new Resolver());
        }

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
    override postValidate(doc: DocumentInfo, value: Node): void {
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
