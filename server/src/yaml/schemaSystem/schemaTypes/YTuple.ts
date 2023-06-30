import { Node, isCollection } from "yaml";
import { CustomPosition } from "../../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { YamlSchema, SchemaValidationError } from "../schemaTypes.js";

export class YTuple extends YamlSchema {
    constructor(public itemSchema: YamlSchema[] = []) {
        super();
    }
    override getDescription() {
        return `a tuple in which items are: '${this.itemSchema.map((schema) => schema.getDescription()).join("', '")}'`;
    }
    override preValidate(doc: DocumentInfo, value: Node): void {
        if (!isCollection(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value)];
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
