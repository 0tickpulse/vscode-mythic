import { Node, isScalar } from "yaml";
import { CustomRange } from "../../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { YamlSchema, SchemaValidationError } from "../schemaTypes.js";

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
    override preValidate(doc: DocumentInfo, value: Node): void {
        const range = value.range && CustomRange.fromYamlRange(doc.lineLengths, value.range);
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value, range)];
        }
        const num = Number(value.value);
        if (isNaN(num)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value, range)];
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
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value, range)];
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
