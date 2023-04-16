import { Pool, Worker, expose, isWorkerRuntime, spawn } from "threads";
import { Optional, Result } from "tick-ts-utils";
import { Diagnostic, Hover } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Document } from "yaml";
import { Highlight } from "../../colors.js";
import { CustomPosition, CustomRange, NumericHover, r } from "../../utils/positionsAndRanges.js";
import { YamlSchema } from "../schemaSystem/schemaTypes.js";
import { ParseSync, parseSyncInner } from "./parseSync.js";

export class DocumentInfo {
    /** cached source */
    source: string;
    hovers: NumericHover[] = [];
    schema: Optional<YamlSchema> = Optional.empty();
    errors: Diagnostic[] = [];
    // highlights: Map<number, Color> = new Map();
    #highlights: Highlight[] = [];
    constructor(public base: TextDocument, public yamlAst: Document, hovers?: NumericHover[], schema?: YamlSchema, errors?: Diagnostic[]) {
        this.source = base.getText();
        this.hovers = hovers ?? [];
        this.schema = Optional.of(schema);
        this.errors = errors ?? [];
    }
    setSchema(schema: YamlSchema) {
        this.schema = Optional.of(schema);
    }
    addHover(hover: NumericHover) {
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
    getHoversAt(position: number): NumericHover[] {
        return this.hovers.filter((hover) => hover.range.contains(position));
    }
    removeAllHighlights() {
        this.#highlights = [];
    }
}

/**
 * It currently doesn't work.
 */
// export const WORKER_POOL = Pool(() => spawn<ParseSync>(new Worker("./server.js")), { size: 4 });

/**
 * Please don't use this function. It doesn't work.
 *
 * Like {@link parseSyncInner} but runs in a separate worker thread instead of the main thread.
 * This allows for concurrent parsing of multiple documents at once.
 *
 * @param document The document to parse.
 * @returns The parsed document.
 */
// export async function parse(document: TextDocument): Promise<Result<DocumentInfo, unknown>> {
//     try {
//         return Result.ok(
//             await WORKER_POOL.queue((worker) =>
//                 worker.parseSync({ uri: document.uri, languageId: document.languageId, version: document.version, source: document.getText() }),
//             ),
//         );
//     } catch (e) {
//         return Result.error(e);
//     }
// }
