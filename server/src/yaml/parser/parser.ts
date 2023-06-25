import { Optional } from "tick-ts-utils";
import { Diagnostic, Hover } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Document } from "yaml";
import { Highlight } from "../../colors.js";
import { CustomPosition, CustomRange, r } from "../../utils/positionsAndRanges.js";
import { YamlSchema } from "../schemaSystem/schemaTypes.js";
import { URI } from "vscode-uri";

/**
 * Describes a link between two ranges in two documents.
 * Used, for example, with goto definition and goto references.
 */
export class RangeLink {
    constructor(public fromRange: CustomRange, public targetRange: CustomRange, public targetDoc: DocumentInfo) {}
    toString() {
        return `RangeLink(${this.fromRange} -> ${this.targetDoc} ${this.targetRange})`;
    }
}

export class DocumentInfo {
    /** cached source */
    source: string;
    hovers: Hover[] = [];
    schema: Optional<YamlSchema> = Optional.empty();
    errors: Diagnostic[] = [];
    // highlights: Map<number, Color> = new Map();
    highlights: Highlight[] = [];
    gotoDefinitions: RangeLink[] = [];
    gotoReferences: RangeLink[] = [];
    constructor(public base: TextDocument, public yamlAst: Document, hovers?: Hover[], schema?: YamlSchema, errors?: Diagnostic[]) {
        this.source = base.getText();
        this.hovers = hovers ?? [];
        this.schema = Optional.of(schema);
        this.errors = errors ?? [];
    }
    setSchema(schema: YamlSchema) {
        this.schema = Optional.of(schema);
    }
    addHover(hover: Hover) {
        this.hovers.push(hover);
    }
    addError(error: Diagnostic) {
        this.errors.push(error);
    }
    addHighlight(highlight: Highlight) {
        if (highlight.range.start.line === highlight.range.end.line) {
            this.highlights.unshift(highlight);
            return;
        }

        const lines = highlight.range.getFrom(this.base.getText()).split("\n");

        let lastChar = highlight.range.start.character;
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length;
            const range = new CustomRange(
                new CustomPosition(highlight.range.start.line + i, lastChar),
                new CustomPosition(highlight.range.start.line + i, lastChar + lineLength),
            );
            this.highlights.unshift(new Highlight(range, highlight.color));
            lastChar = 0;
        }
    }
    addGotoDefinitionAndReverseReference(definition: RangeLink) {
        this.addGotoDefinition(definition);
        definition.targetDoc.addGotoReference(new RangeLink(definition.targetRange, definition.fromRange, this));
    }
    addGotoDefinition(definition: RangeLink) {
        this.gotoDefinitions.push(definition);
    }
    addGotoReference(reference: RangeLink) {
        this.gotoReferences.push(reference);
    }
    getHoversAt(position: CustomPosition): Hover[] {
        return this.hovers.filter((hover) => r(hover.range!).contains(position));
    }
    removeAllHighlights() {
        this.highlights = [];
    }
    toString() {
        return `DocumentInfo(${this.base.uri})`;
    }
    fmt() {
        return URI.parse(this.base.uri).fsPath;
    }
}
