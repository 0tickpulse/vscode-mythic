import { Node } from "yaml";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { YamlSchema } from "../schemaTypes.js";

// TODO

export class YMythicCondition extends YamlSchema {
    constructor() {
        super();
    }
    override getDescription() {
        return "a condition";
    }
    override preValidate(doc: DocumentInfo, value: Node): void {
        return [];
    }
    get rawTypeText() {
        return "condition";
    }
}
