import picomatch from "picomatch";
import { Optional } from "tick-ts-utils";
import { Diagnostic, Hover, SemanticTokenTypes } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Document, LineCounter, parseDocument, visit } from "yaml";
import { Highlight } from "../../colors.js";
import { CustomPosition, CustomRange, r } from "../../utils/positionsAndRanges.js";
import { PATH_MAP } from "../schemaSystem/data.js";
import { YamlSchema } from "../schemaSystem/schemaTypes.js";

export class DocumentInfo {
    hovers: Hover[] = [];
    schema: Optional<YamlSchema> = Optional.empty();
    errors: Diagnostic[] = [];
    // highlights: Map<number, Color> = new Map();
    #highlights: Highlight[] = [];
    #semanticTokens: number[] = [];
    constructor(public base: TextDocument, public yamlAst: Document, hovers?: Hover[], schema?: YamlSchema, errors?: Diagnostic[]) {
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
    addHighlights(...highlights: Highlight[]) {
        highlights.forEach((highlight) => {
            const lines = highlight.range.getFrom(this.base.getText()).split("\n");
            if (lines.length === 1) {
                this.#highlights.unshift(highlight);
                return;
            }

            let lastChar = highlight.range.start.character;
            for (let i = 0; i < lines.length; i++) {
                const lineLength = lines[i].length;
                const range = new CustomRange(
                    new CustomPosition(highlight.range.start.line + i, lastChar),
                    new CustomPosition(highlight.range.start.line + i, lastChar + lineLength),
                );
                this.#highlights.unshift(new Highlight(range, highlight.color));
                lastChar = 0;
            }
        });
    }
    get highlights() {
        return this.#highlights;
    }
    getHoversAt(position: CustomPosition): Hover[] {
        return this.hovers.filter((hover) => r(hover.range!).contains(position));
    }
    removeAllHighlights() {
        this.#highlights = [];
    }
}

export function parse(document: TextDocument) {
    const source = document.getText();
    const documentInfo = new DocumentInfo(
        document,
        parseDocument(source, {
            lineCounter: new LineCounter(),
        }),
    );
    const { yamlAst } = documentInfo;
    const { contents } = yamlAst;
    if (contents === null) {
        return documentInfo;
    }

    console.time("parse (finding schema)");
    PATH_MAP.forEach((schema, pathMatcher) => {
        if (picomatch(pathMatcher)(document.uri)) {
            documentInfo.setSchema(schema);
        }
    });
    console.timeEnd("parse (finding schema)");

    console.time("parse (yaml ast visiting)");
    // syntax highlighting
    visit(yamlAst, {
        Scalar(key, node) {
            console.time("parse (yaml ast visiting) (Scalar)");
            if (key === "key") {
                documentInfo.addHighlights(new Highlight(CustomRange.fromYamlRange(source, node.range!), SemanticTokenTypes.property));
                return;
            }
            const { value, range } = node;
            const color: SemanticTokenTypes = !isNaN(Number(value)) ? SemanticTokenTypes.number : SemanticTokenTypes.string;
            documentInfo.addHighlights(new Highlight(CustomRange.fromYamlRange(source, range!), color));
            console.timeEnd("parse (yaml ast visiting) (Scalar)");
        },
    });
    console.timeEnd("parse (yaml ast visiting)");

    console.time("parse (finding comments)");
    source.split("\n").forEach((line, index) => {
        // index of #
        const commentIndex = line.indexOf("#");
        if (commentIndex !== -1) {
            documentInfo.addHighlights(
                new Highlight(
                    new CustomRange(new CustomPosition(index, commentIndex), new CustomPosition(index, line.length)),
                    SemanticTokenTypes.comment,
                ),
            );
        }
    });
    console.timeEnd("parse (finding comments)");

    const { schema } = documentInfo;
    documentInfo.yamlAst.errors.forEach((error) =>
    documentInfo.addError({
        message: error.message,
        range: new CustomRange(CustomPosition.fromOffset(source, error.pos[0]), CustomPosition.fromOffset(source, error.pos[1])),
        severity: 1,
        source: "Mythic Language Server",
    }),
    );
    if (!schema.isEmpty()) {
        console.time("parse (schema validation)");
        // console.log(`Schema found for ${document.uri}: ${schema.get().getDescription()}`);
        const errors = schema.get().validateAndModify(documentInfo, yamlAst.contents!);
        errors.otherwise([]).forEach(
            (error) =>
                error.range !== null &&
                documentInfo.addError({
                    message: error.message,
                    range: error.range,
                    severity: 1,
                    source: "Mythic Language Server",
                }),
        );
        console.timeEnd("parse (schema validation)");
    }

    return documentInfo;
}
