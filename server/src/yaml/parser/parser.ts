import picomatch from "picomatch";
import { Optional } from "tick-ts-utils";
import { Diagnostic, Hover } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Document, LineCounter, parseDocument, visit } from "yaml";
import { COLORS, Color, Highlight } from "../../colors.js";
import { CustomPosition, CustomRange, r } from "../../utils/positionsAndRanges.js";
import { PATH_MAP } from "../schemaSystem/data.js";
import { YamlSchema } from "../schemaSystem/schemaTypes.js";

export class DocumentInfo {
    hovers: Hover[] = [];
    schema: Optional<YamlSchema> = Optional.empty();
    errors: Diagnostic[] = [];
    highlights: Map<number, Color> = new Map();
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
            const start = highlight.range.start.toOffset(this.base.getText());
            const end = highlight.range.end.toOffset(this.base.getText());
            for (let i = start; i < end; i++) {
                this.highlights.set(i, highlight.color);
            }
        });
    }
    compileHighlights(): Highlight[] {
        const highlights: Highlight[] = [];
        this.highlights.forEach((color, position) => {
            const highlight = new Highlight(
                new CustomRange(
                    CustomPosition.fromOffset(this.base.getText(), position),
                    CustomPosition.fromOffset(this.base.getText(), position + 1),
                ),
                color,
            );
            highlights.push(highlight);
        });
        return highlights;
    }
    getHoversAt(position: CustomPosition): Hover[] {
        return this.hovers.filter((hover) => r(hover.range!).contains(position));
    }
    removeAllHighlights() {
        this.highlights.clear();
    }
}

export function parse(document: TextDocument) {
    const source = document.getText();
    const documentInfo = new DocumentInfo(document, parseDocument(source, {
        lineCounter: new LineCounter(),
    }));
    const { yamlAst } = documentInfo;
    const { contents } = yamlAst;
    if (contents === null) {
        return documentInfo;
    }
    PATH_MAP.forEach((schema, pathMatcher) => {
        console.log(`Checking ${document.uri} against ${pathMatcher}`);
        if (picomatch(pathMatcher)(document.uri)) {
            console.log(`Matched ${document.uri} against ${pathMatcher}`);
            documentInfo.setSchema(schema);
        }
    });

    // syntax highlighting
    visit(yamlAst, {
        Scalar(key, node) {
            if (key === "key") {
                documentInfo.addHighlights(new Highlight(CustomRange.fromYamlRange(source, node.range!), "yamlKey"));
                return;
            }
            const { value, range } = node;
            const color: keyof typeof COLORS = !isNaN(Number(value)) ? "yamlValueNumber" : "yamlValue";
            documentInfo.addHighlights(new Highlight(CustomRange.fromYamlRange(source, range!), color));
        },
    });

    const { schema } = documentInfo;
    documentInfo.yamlAst.errors.forEach((error) =>
        documentInfo.addError({
            message: error.message,
            range: new CustomRange(CustomPosition.fromOffset(source, error.pos[0]), CustomPosition.fromOffset(source, error.pos[1])),
            severity: 1,
            source: "Mythic Language Server",
        }),
    );
    if (schema.isEmpty()) {
        return documentInfo;
    }
    console.log(`Schema found for ${document.uri}: ${schema.get().getDescription()}`);
    const errors = schema.get().validateAndModify(documentInfo, yamlAst.contents!);
    errors.otherwise([]).forEach((error) =>
        error.range && documentInfo.addError({
            message: error.message,
            range: error.range,
            severity: 1,
            source: "Mythic Language Server",
        }),
    );
    return documentInfo;
}
