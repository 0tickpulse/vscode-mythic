import { Optional, Result } from "tick-ts-utils";
import { Diagnostic, Hover, SemanticTokenTypes } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Document, LineCounter, parseDocument, visit } from "yaml";
import { Highlight } from "../../colors.js";
import { CustomPosition, CustomRange, r } from "../../utils/positionsAndRanges.js";
import { YamlSchema } from "../schemaSystem/schemaTypes.js";
import { join } from "path";
import picomatch from "picomatch";
import { PATH_MAP } from "../schemaSystem/data.js";
import * as workerpool from "workerpool";

export class DocumentInfo {
    hovers: Hover[] = [];
    schema: Optional<YamlSchema> = Optional.empty();
    errors: Diagnostic[] = [];
    lastUpdate: number;
    // highlights: Map<number, Color> = new Map();
    #highlights: Highlight[] = [];
    constructor(public base: TextDocument, public yamlAst: Document, hovers?: Hover[], schema?: YamlSchema, errors?: Diagnostic[]) {
        this.hovers = hovers ?? [];
        this.schema = Optional.of(schema);
        this.errors = errors ?? [];
        this.lastUpdate = Date.now();
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
            this.#highlights.unshift(highlight);
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
            this.#highlights.unshift(new Highlight(range, highlight.color));
            lastChar = 0;
        }
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

export function parseSync({ uri, languageId, version, source }: Pick<TextDocument, "uri" | "languageId" | "version"> & { source: string }) {
    const document = TextDocument.create(uri, languageId, version, source);
    const documentInfo = new DocumentInfo(document, parseDocument(source));
    const { yamlAst } = documentInfo;
    const { contents } = yamlAst;
    if (contents === null) {
        return documentInfo;
    }

    console.time("parse (finding schema)");
    PATH_MAP.forEach((schema, pathMatcher) => {
        if (picomatch(pathMatcher)(uri)) {
            documentInfo.setSchema(schema);
        }
    });
    console.timeEnd("parse (finding schema)");

    console.time("parse (yaml ast visiting)");
    // syntax highlighting
    visit(yamlAst, {
        Scalar(key, node) {
            if (key === "key") {
                documentInfo.addHighlight(new Highlight(CustomRange.fromYamlRange(source, node.range!), SemanticTokenTypes.property));
                return;
            }
            const { value, range } = node;
            const color: SemanticTokenTypes = !isNaN(Number(value)) ? SemanticTokenTypes.number : SemanticTokenTypes.string;
            documentInfo.addHighlight(new Highlight(CustomRange.fromYamlRange(source, range!), color));
        },
    });
    console.timeEnd("parse (yaml ast visiting)");

    console.time("parse (finding comments)");
    source.split("\n").forEach((line, index) => {
        // index of #
        const commentIndex = line.indexOf("#");
        if (commentIndex !== -1) {
            documentInfo.addHighlight(
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
        console.time(`parse (schema validation) (${schema.get().toString()})})`);
        // console.log(`Schema found for ${uri}: ${schema.get().getDescription()}`);
        const errors = schema.get().validateAndModify(documentInfo, yamlAst.contents!);
        console.timeEnd(`parse (schema validation) (${schema.get().toString()})})`);
        console.time("parse (adding errors)");
        errors.forEach(
            (error) =>
                error.range !== null &&
                documentInfo.addError({
                    message: error.message,
                    range: error.range,
                    severity: 1,
                    source: "Mythic Language Server",
                }),
        );
        console.timeEnd("parse (adding errors)");
    }

    return documentInfo;
}

export const WORKER_POOL = workerpool.pool(__filename, {
    onCreateWorker(options) {
        console.log("[Parser] Created new worker.");
    },
    workerType: "auto",
    workerThreadOpts: {
        stdin: false,
        stdout: false,
    },
});

/**
 * Like {@link parseSync} but runs in a separate worker thread instead of the main thread.
 * This allows for concurrent parsing of multiple documents at once.
 *
 * @param document The document to parse.
 * @returns The parsed document.
 */
export async function parse(document: TextDocument): Promise<Result<DocumentInfo, unknown>> {
    try {
        return Result.ok(
            await WORKER_POOL.exec("parseSync", [
                {
                    uri: document.uri,
                    languageId: document.languageId,
                    version: document.version,
                    source: document.getText(),
                },
            ]),
        );
    } catch (e) {
        return Result.error(e);
    }
}

workerpool.worker({
    parseSync,
});
