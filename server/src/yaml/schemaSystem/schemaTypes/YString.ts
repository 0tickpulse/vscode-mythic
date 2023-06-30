import { Optional } from "tick-ts-utils";
import { Node, isScalar } from "yaml";
import { Resolver } from "../../../mythicParser/resolver.js";
import { CustomPosition, CustomRange } from "../../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { cursorValidInRange, getNodeValueYamlRange, scalarValue } from "../schemaUtils.js";
import { MythicScanner } from "../../../mythicParser/scanner.js";
import { Parser } from "../../../mythicParser/parser.js";
import { YamlSchema, SchemaValidationError } from "../schemaTypes.js";

export class YString extends YamlSchema {
    literal: Optional<string>;
    completionItem: Optional<CompletionItem>;
    constructor(literal?: string, public caseSensitive = true, public supportsPlaceholders = true) {
        super();
        this.literal = Optional.of(literal);
        this.completionItem = this.literal.map((literal) => ({
            label: literal,
            kind: CompletionItemKind.Value,
            insertText: literal,
        }));
    }
    setLiteral(literal: string) {
        this.literal = Optional.of(literal);
        return this;
    }
    removeLiteral() {
        this.literal = Optional.empty();
        return this;
    }
    override getDescription() {
        return this.literal.map((literal) => `"${literal}"`).otherwise("a string");
    }
    override autoComplete(doc: DocumentInfo, value: Node, cursor: CustomPosition): void {
        if (!isScalar(value)) {
            return;
        }
        const range = CustomRange.fromYamlRange(doc.lineLengths, value.range!);
        if (cursor !== undefined && cursorValidInRange(doc, range, cursor) && this.completionItem.isPresent()) {
            // const start = scalarValue(value);
            // const isValid = start.trim() === "" || this.literal.get().toLowerCase().startsWith(start.toLowerCase());
            // console.table({
            //     start,
            //     literal: this.literal.get(),
            //     isValid,
            // });
            doc.autoCompletions.push(this.completionItem.get());
        }
    }
    override preValidate(doc: DocumentInfo, value: Node): void {
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value)];
        }
        const str = String(scalarValue(value));
        if (this.literal.isPresent() && !this.#check(str, this.literal.get())) {
            return [new SchemaValidationError(this, `Expected value "${this.literal.get()}"!`, doc, value)];
        }
        return [];
    }
    override postValidate(doc: DocumentInfo, value: Node): void {
        if (!isScalar(value)) {
            return [];
        }
        const str = String(scalarValue(value));

        if (this.supportsPlaceholders) {
            const range = getNodeValueYamlRange(doc, value);
            const scanner = new MythicScanner(str).scanTokens();
            const parser = new Parser(scanner);
            const ast = parser.parseMlcValue();
            ast.ifPresent((ast) => {
                const resolver = new Resolver().setAst(ast);
                resolver.resolveWithDoc(doc, range[0]);
            });
        }

        return [];
    }
    #check(value1: string, value2: string) {
        return this.caseSensitive ? value1 === value2 : value1.toLowerCase() === value2.toLowerCase();
    }
    get rawTypeText() {
        return this.literal.map((literal) => `"${literal}"`).otherwise("string");
    }
}
