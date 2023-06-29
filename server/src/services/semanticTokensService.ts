import {
    CancellationToken,
    ResultProgressReporter,
    SemanticTokens,
    SemanticTokensParams,
    SemanticTokensPartialResult,
    WorkDoneProgressReporter,
} from "vscode-languageserver";
import { globalData } from "../documentManager.js";
import { FULL_PARSE_QUEUE, PARTIAL_PARSE_QUEUE } from "../yaml/parser/parseSync.js";
import { logEvent } from "../utils/logging.js";

// /**
//  * Map of document URIs to semantic tokens.
//  */
// const SEMANTIC_TOKEN_CACHE = new Map<string, SemanticTokens>();
// onFlush(() => {
//     SEMANTIC_TOKEN_CACHE.clear();
// })

export default async ({ textDocument }: SemanticTokensParams): Promise<SemanticTokens> => {
    logEvent("semanticTokensService", textDocument);
    const { uri } = textDocument;
    const doc = globalData.documents.getDocument(uri);
    if (!doc) {
        logEvent("semanticTokensService", textDocument, "(no document)");
        return null as unknown as SemanticTokens; // the lsp spec allows null to be returned, but the typescript types don't. this should hopefully be fixed soon
    }
    const { highlights } = doc;

    if (PARTIAL_PARSE_QUEUE.size > 0 && FULL_PARSE_QUEUE.size > 0) {
        logEvent("semanticTokensService", textDocument, "(waiting for parse)");
        // hasn't been parsed yet
        return null as unknown as SemanticTokens; // refer to above comment
    }

    logEvent("semanticTokensService", textDocument, `(processing ${highlights.length} highlights)`);
    highlights.sort((a, b) => a.range.start.compareTo(b.range.start));

    let lastLine = 0;
    let lastChar = 0;
    const tokens = new Array(highlights.length * 5);
    let tokenIndex = 0;

    for (let i = 0; i < highlights.length; i++) {
        const highlight = highlights[i];
        const line = highlight.range.start.line - lastLine;
        const char = line === 0 ? highlight.range.start.character - lastChar : highlight.range.start.character;
        const length = highlight.range.end.character - highlight.range.start.character;
        const type = highlight.getColorIndex();
        tokens[tokenIndex++] = line;
        tokens[tokenIndex++] = char;
        tokens[tokenIndex++] = length;
        tokens[tokenIndex++] = type;
        tokens[tokenIndex++] = 0;
        lastLine = highlight.range.start.line;
        lastChar = highlight.range.start.character;
    }
    return { data: tokens };
};
