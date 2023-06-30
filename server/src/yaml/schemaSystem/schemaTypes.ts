import { Node } from "yaml";
import { CustomPosition, CustomRange } from "../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../parser/documentInfo.js";
import { Hover } from "vscode-languageserver";
import { server } from "../../index.js";
import { getNodeValueRange } from "./schemaUtils.js";

export class SchemaValidationError {
    message: string;
    constructor(
        public expectedType: YamlSchema,
        message: string,
        public doc: DocumentInfo,
        public node: Node | null,
        public range = node !== null ? CustomRange.fromYamlRange(doc.lineLengths, node.range!) : null,
    ) {
        this.message = message; //+ `\n\nGot: ${node?.toString()}`; // TODO - Format the message better
    }
}

/**
 * The root schema.
 */
export class YamlSchema {
    /**
     * The name of this schema, if any.
     * This name is similar to a type alias, and will be displayed in messages.
     * Recommended for complex schemas.
     */
    name?: string;
    getDescription(): string {
        return "unknown";
    }
    additionalPreValidators: ((doc: DocumentInfo, value: Node) => void)[] = [];
    additionalPostValidators: ((doc: DocumentInfo, value: Node) => void)[] = [];
    onPreValidation(additionalValidator: (doc: DocumentInfo, value: Node) => void) {
        this.additionalPreValidators.push(additionalValidator);
        return this;
    }
    onPostValidation(additionalPostValidator: (doc: DocumentInfo, value: Node) => void) {
        this.additionalPostValidators.push(additionalPostValidator);
        return this;
    }
    /**
     * The first validation step, which should be used for simple validation of types, values, etc.
     * This can be used to index things to be used in the second validation step.
     *
     * @param doc   The document to validate and modify
     * @param value The value to validate and modify
     */
    runPreValidation(doc: DocumentInfo, value: Node): void {
        this.preValidate(doc, value);
        for (const preValidator of this.additionalPreValidators) {
            preValidator(doc, value);
        }
    }
    protected preValidate(doc: DocumentInfo, value: Node): void {
        // do nothing
    }
    /**
     * The second validation step, which should be used for more complex validation.
     * Note that the second validation step only runs on nodes that pass the first validation step.
     * Also note that the second validation step does not run on all files in the workspace on launch.
     * This is contrary to the first validation step, and is intentionally done to improve performance.
     *
     * @param doc   The document to validate and modify
     * @param value The value to validate and modify
     */
    runPostValidation(doc: DocumentInfo, value: Node): void {
        this.postValidate(doc, value);
        for (const postValidator of this.additionalPostValidators) {
            postValidator(doc, value);
        }
    }
    autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        return;
    }
    protected postValidate(doc: DocumentInfo, value: Node): void {
        // do nothing
    }
    /**
     * The raw description of this schema, as a string.
     * Type text should be a **complete** description of the type, and should be legible, specific, and concise.
     */
    get rawTypeText() {
        return "unknown";
    }
    /**
     * The type of this schema, as a string.
     * Will use {@link name} if it exists, otherwise {@link rawTypeText}.
     */
    get typeText() {
        return this.name ?? this.rawTypeText;
    }
    setName(name: string) {
        this.name = name;
        return this;
    }
}


