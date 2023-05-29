import { TextDocument } from "vscode-languageserver-textdocument";
import { parseDocument } from "yaml";
import { CustomPosition, CustomRange } from "../../utils/positionsAndRanges.js";
import picomatch from "picomatch";
import { PATH_MAP } from "../schemaSystem/data.js";
import { DocumentInfo } from "./parser.js";
import { expose } from "threads";
import { documents } from "../../documentManager.js";
import { server } from "../../index.js";

/**
 * This is a set of URIs that are currently being parsed.
 * When a file gets edited, it gets added to this set.
 * Every set interval, the parser will check this set and parse any files that are in it.
 * This is to prevent the parser from parsing the same file more times than necessary.
 */
const TO_PARSE = new Set<TextDocument>();

export function scheduleDocument(doc: TextDocument) {
    TO_PARSE.add(doc);
}

const INTERVAL = 600;

/**
 * Run when the lsp server starts.
 * This will schedule the parser to run every set interval to parse any files that are in the TO_PARSE set.
 * Warning: This will run forever.
 */
export function scheduleParse() {
    setInterval(() => {
        if (TO_PARSE.size === 0) {
            return;
        }
        console.log(`[parseSync] Parsing ${TO_PARSE.size} documents`);
        const toParse = [...TO_PARSE];
        TO_PARSE.clear();
        toParse.forEach((doc) => {
            const documentInfo = parseSync(doc);
            documents.set(documentInfo);
            server.connection.sendDiagnostics({ uri: doc.uri, diagnostics: documentInfo.errors });
            server.connection.languages.semanticTokens.refresh();
        });
    }, INTERVAL);
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

export type ParseSync = { parseSync: typeof parseSyncInner };
