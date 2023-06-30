import { Node } from "yaml";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { YamlSchema } from "../schemaTypes.js";

// TODO

export class YMythicItem extends YamlSchema {
    constructor() {
        super();
    }
    override getDescription() {
        return "an item";
    }
    override preValidate(doc: DocumentInfo, value: Node): void {
        return [];
    }
    get rawTypeText() {
        return "item";
    }
}
