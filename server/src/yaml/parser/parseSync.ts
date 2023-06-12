import { TextDocument } from "vscode-languageserver-textdocument";
import { parseDocument } from "yaml";
import { CustomPosition, CustomRange } from "../../utils/positionsAndRanges.js";
import picomatch from "picomatch";
import { PATH_MAP } from "../schemaSystem/data.js";
import { DocumentInfo } from "./parser.js";
import { expose } from "threads";
import { data } from "../../documentManager.js";
import { server } from "../../index.js";
import { Optional } from "tick-ts-utils";

export const PARSE_QUEUE: Set<TextDocument> = new Set();
export let scheduledParse: Optional<NodeJS.Timeout> = Optional.empty();
export function queueDocumentForParse(doc: TextDocument) {
    PARSE_QUEUE.add(doc);
    scheduleParse();
}
export function scheduleParse() {
    scheduledParse.ifPresent(clearTimeout);
    scheduledParse = Optional.of(
        setTimeout(() => {
            if (PARSE_QUEUE.size === 0) {
                return;
            }
            console.log(`[parseSync] Parsing ${PARSE_QUEUE.size} documents`);
            PARSE_QUEUE.forEach((doc) => {
                const documentInfo = parseSync(doc);
                data.documents.set(documentInfo);
                server.connection.sendDiagnostics({ uri: doc.uri, diagnostics: documentInfo.errors });
            });
            PARSE_QUEUE.clear();
            server.connection.languages.semanticTokens.refresh();
        }, 1000),
    );
}

export function parseSync(doc: TextDocument) {
    return parseSyncInner({
        uri: doc.uri,
        languageId: doc.languageId,
        version: doc.version,
        source: doc.getText(),
    });
}

export function parseSyncInner({ uri, languageId, version, source }: Pick<TextDocument, "uri" | "languageId" | "version"> & { source: string }) {
    const document = TextDocument.create(uri, languageId, version, source);
    const documentInfo = new DocumentInfo(document, parseDocument(source));
    const { yamlAst } = documentInfo;
    const { contents } = yamlAst;
    if (contents === null) {
        return documentInfo;
    }

    console.time("parse (finding schema)");
    PATH_MAP.forEach(({ schema, picoMatch }, pathMatcher) => {
        if (picoMatch(uri)) {
            console.log(`Schema found for ${uri}: ${schema.getTypeText()} (picoMatch)`);
            documentInfo.setSchema(schema);
        }
    });
    console.timeEnd("parse (finding schema)");

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
        console.time(`parse (schema validation) (${schema.get().getTypeText()})})`);
        // console.log(`Schema found for ${uri}: ${schema.get().getDescription()}`);
        const errors = schema.get().validateAndModify(documentInfo, yamlAst.contents!);
        console.timeEnd(`parse (schema validation) (${schema.get().getTypeText()})})`);
        console.time("parse (adding errors)");
        errors.forEach((error) => {
            console.log(`Error: ${JSON.stringify(error)}`);
            error.range !== null &&
                documentInfo.addError({
                    message: error.message,
                    range: error.range,
                    severity: 1,
                    source: "Mythic Language Server",
                });
        });
        console.timeEnd("parse (adding errors)");
    }

    return documentInfo;
}

export type ParseSync = { parseSync: typeof parseSyncInner };
