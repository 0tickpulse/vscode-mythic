import { Node, isMap } from "yaml";
import { CustomPosition } from "../../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { YamlSchema, SchemaValidationError } from "../schemaTypes.js";

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
    override preValidate(doc: DocumentInfo, value: Node): void {
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value)];
        }

        const errors: SchemaValidationError[] = [];

        const { items } = value;
        for (const item of items) {
            const error = this.values.runPreValidation(doc, item.value as Node);
            errors.push(...error);
        }

        return errors;
    }
    override postValidate(doc: DocumentInfo, value: Node): void {
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
