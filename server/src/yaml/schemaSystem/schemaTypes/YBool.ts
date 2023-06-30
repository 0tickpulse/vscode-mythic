import { Node, isScalar } from "yaml";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { scalarValue } from "../schemaUtils.js";
import { YamlSchema, SchemaValidationError } from "../schemaTypes.js";

export class YBool extends YamlSchema {
    override getDescription() {
        return "a boolean";
    }
    override preValidate(doc: DocumentInfo, value: Node): void {
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value)];
        }
        const str = scalarValue(value);
        if (str !== true && str !== false) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}! Got ${str}`, doc, value)];
        }
        return [];
    }
    get rawTypeText() {
        return "bool";
    }
}
