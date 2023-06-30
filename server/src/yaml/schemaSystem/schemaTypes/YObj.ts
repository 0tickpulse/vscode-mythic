import { Optional, stripIndentation } from "tick-ts-utils";
import { Node, Scalar, isMap } from "yaml";
import { CustomPosition, CustomRange } from "../../../utils/positionsAndRanges.js";
import { getClosestTo } from "../../../utils/utils.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { YamlSchema, SchemaValidationError } from "../schemaTypes.js";

export class YObj extends YamlSchema {
    constructor(
        public properties: Record<
            string,
            {
                schema: YamlSchema;
                required?: boolean;
                description?: string;
                /**
                 * Conditions that must be met for this property to be valid.
                 */
                conditions?: ((doc: DocumentInfo, value: Node) => Optional<string>)[];
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
    override preValidate(doc: DocumentInfo, value: Node): void {
        if (!isMap(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value)];
        }

        const { items } = value;

        const errors: SchemaValidationError[] = [];

        // iterate over schema
        for (const [key, { schema, required, description, conditions }] of Object.entries(this.properties)) {
            const item = items.find((i) => {
                if (i.key === null) {
                    return false;
                }
                return (i.key as any).value === key;
            }) as { key: Node; value: Node } | undefined;
            if (item) {
                const error = schema.runPreValidation(doc, item.value);
                errors.push(...error);
                if (item.key !== null) {
                    if (description) {
                        const range = item.key.range;
                        if (range) {
                            const customRange = CustomRange.fromYamlRange(doc.lineLengths, range);
                            customRange &&
                                doc.addHover({
                                    range: customRange,
                                    contents: stripIndentation`Property \`${this.name ?? ""}${key}\`: \`${schema.typeText}\`

                                    ${description}`,
                                });
                        }
                    }
                    conditions?.forEach((condition) => {
                        condition(doc, value).ifPresent((message) => {
                            errors.push(new SchemaValidationError(this, message, doc, item.key));
                        });
                    });
                }
            } else if (required) {
                errors.push(new SchemaValidationError(this, `Missing required property "${key}"!`, doc, value));
            }
        }

        // iterate over object
        for (const item of items) {
            if (item.key === null) {
                continue;
            }
            const key = (item.key as Scalar).toString();
            const range = (item.key as Node).range;
            const customRange = range ? CustomRange.fromYamlRange(doc.lineLengths, range) : undefined;
            if (!this.properties[key]) {
                const closest = getClosestTo(key, Object.keys(this.properties));
                let message = `Unknown property "${key}"!`;
                if (closest) {
                    message += ` Did you mean "${closest}"?`;
                }
                errors.push(new SchemaValidationError(this, message, doc, value, customRange));
            }
        }

        return errors;
    }
    override postValidate(doc: DocumentInfo, value: Node): void {
        if (!isMap(value)) {
            return [];
        }
        const errors: SchemaValidationError[] = [];
        const { items } = value;
        for (const item of items) {
            if (item.key !== null) {
                const key = (item.key as any).value;
                const schema = this.properties[key]?.schema;
                if (!schema) {
                    continue;
                }
                const innerErrors = schema.runPostValidation(doc, item.value as Node);
                errors.push(...innerErrors);
            }
        }
        return errors;
    }
    override autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        if (!isMap(value)) {
            return;
        }
        const { items } = value;
        for (const item of items) {
            if (item.key === null) {
                continue;
            }
            const key = (item.key as any).value;
            const schema = this.properties[key]?.schema;
            if (!schema) {
                continue;
            }
            schema.autoComplete(doc, item.value as Node, cursor);
        }
    }
    get rawTypeText() {
        return `object(${Object.entries(this.properties)
            .map(([key, { schema }]) => `${key}: ${schema.typeText}`)
            .join(", ")})`;
    }
}
