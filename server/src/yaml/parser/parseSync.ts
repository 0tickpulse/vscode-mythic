import { Optional } from "tick-ts-utils";
import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseDocument } from "yaml";
import { globalData } from "../../documentManager.js";
import { server } from "../../index.js";
import { CustomPosition, CustomRange } from "../../utils/positionsAndRanges.js";
import { PATH_MAP } from "../schemaSystem/data.js";
import { DocumentInfo } from "./parser.js";

class DocumentQueue {
    #items: TextDocument[] = [];
    get items() {
        return this.#items;
    }
    add(doc: TextDocument) {
        for (const item of this.#items) {
            if (item.uri === doc.uri) {
                return;
            }
        }
        this.#items.push(doc);
    }
    get size() {
        return this.#items.length;
    }
    clear() {
        this.#items = [];
    }
    forEach(callback: (doc: TextDocument) => void) {
        this.#items.forEach(callback);
    }
}

export const PARSE_QUEUE = new DocumentQueue();
export let scheduledParse: Optional<NodeJS.Timeout> = Optional.empty();
export function queueDocumentForParse(doc: TextDocument) {
    PARSE_QUEUE.add(doc);
    console.log(`[parseSync] Queued ${doc.uri} for parsing`);
    scheduleParse();
}
/**
 * Procedures that run before beginning to parse all documents.
 */
const flushProcedures: (() => void)[] = [];
/**
 * Document-specific procedures that run before parsing a document.
 */
const flushDocProcedures: ((doc: TextDocument) => void)[] = [];
export function onFlush(procedure: () => void) {
    flushProcedures.push(procedure);
}
export function onFlushDoc(procedure: (doc: TextDocument) => void) {
    flushDocProcedures.push(procedure);
}
export function scheduleParse() {
    scheduledParse.ifPresent(clearTimeout);
    scheduledParse = Optional.of(
        setTimeout(() => {
            if (PARSE_QUEUE.size === 0) {
                return;
            }
            console.log(`[parseSync] Parsing ${PARSE_QUEUE.size} documents`);
            const diagnostics = new Map<string, Diagnostic[]>();
            flushProcedures.forEach((procedure) => procedure());
            PARSE_QUEUE.forEach((doc) => {
                const documentInfo = preParse(doc);
                globalData.documents.set(documentInfo);
                console.log(`[parseSync] Preparsed ${doc.uri} (${documentInfo.errors.length} errors)`);
            });
            PARSE_QUEUE.forEach((doc) => {
                const documentInfo = postParse(globalData.documents.getDocument(doc.uri)!); // non-null assertion because we just set it in the previous closure
                globalData.documents.set(documentInfo);
                console.log(`[parseSync] Postparsed ${doc.uri} (${documentInfo.errors.length} errors)`);
                diagnostics.set(doc.uri, documentInfo.errors);
            });
            // clear diagnostics
            diagnostics.forEach((diagnostics, uri) => {
                server.connection.sendDiagnostics({ uri, diagnostics });
                console.log(`[parseSync] Sent ${diagnostics.length} diagnostics for ${uri}`);
            });
            PARSE_QUEUE.clear();
            server.connection.languages.semanticTokens.refresh();
        }, 1000),
    );
}

function preParse(doc: TextDocument) {
    const { uri } = doc;
    console.time(`[parseSync] preParse ${uri}`);
    const source = doc.getText();
    const documentInfo = new DocumentInfo(doc, parseDocument(source));
    const { yamlAst } = documentInfo;
    const { contents } = yamlAst;
    if (contents === null) {
        return documentInfo;
    }

    PATH_MAP.forEach(({ schema, picoMatch }, pathMatcher) => {
        if (picoMatch(uri)) {
            documentInfo.setSchema(schema);
        }
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
    schema.ifPresent((schema) => {
        server.connection.sendRequest("language/setLanguage", { uri, language: "mythic" });
        // console.log(`Schema found for ${uri}: ${schema.get().getDescription()}`);
        // const errors = [...schema.get().preValidate(documentInfo, yamlAst.contents!), ...schema.get().validateAndModify(documentInfo, yamlAst.contents!)];
        const errors = schema.preValidate(documentInfo, yamlAst.contents!);
        errors.forEach((error) => {
            error.range !== null &&
                documentInfo.addError({
                    message: error.message,
                    range: error.range,
                    severity: 1,
                    source: "Mythic Language Server",
                });
        });
    });
    console.timeEnd(`[parseSync] preParse ${uri}`);

    return documentInfo;
}

function postParse(doc: DocumentInfo) {
    console.time(`[parseSync] postParse ${doc.base.uri}`);
    doc.schema.ifPresent((schema) => {
        const errors = schema.postValidate(doc, doc.yamlAst.contents!);
        errors.forEach((error) => {
            error.range !== null &&
                doc.addError({
                    message: error.message,
                    range: error.range,
                    severity: 1,
                    source: "Mythic Language Server",
                });
        });
    });
    console.timeEnd(`[parseSync] postParse ${doc.base.uri}`);
    return doc;
}
