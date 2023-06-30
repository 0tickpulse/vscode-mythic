import { Optional } from "tick-ts-utils";
import { Node, isScalar } from "yaml";
import { CustomPosition } from "../../../utils/positionsAndRanges.js";
import { filterMap, getClosestTo } from "../../../utils/utils.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { scalarValue } from "../schemaUtils.js";
import { YString } from "./YString.js";
import { YamlSchema, SchemaValidationError } from "../schemaTypes.js";

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
    override preValidate(doc: DocumentInfo, value: Node): void {
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
        const closest = isScalar(value) ? getClosestTo(String(scalarValue(value)), literals) : undefined;
        return [
            new SchemaValidationError(
                this,
                `Expected ${this.typeText}!${closest !== undefined ? `\nDid you mean ${closest}?\nDoc contents:\n${doc.source}` : ""}`,
                doc,
                value,
            ),
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
