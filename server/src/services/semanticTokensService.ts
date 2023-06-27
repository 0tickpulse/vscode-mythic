import { SemanticTokens, SemanticTokensParams } from "vscode-languageserver";
import { globalData } from "../documentManager.js";
import { PARSE_QUEUE } from "../yaml/parser/parseSync.js";

// /**
//  * Map of document URIs to semantic tokens.
//  */
// const SEMANTIC_TOKEN_CACHE = new Map<string, SemanticTokens>();
// onFlush(() => {
//     SEMANTIC_TOKEN_CACHE.clear();
// })

export default ({ textDocument }: SemanticTokensParams): SemanticTokens => {
    console.log(`[semanticTokensService] ${textDocument.uri}`);
    // const cached = SEMANTIC_TOKEN_CACHE.get(textDocument.uri);
    // if (cached) {
    //     console.log(`[semanticTokensService] ${textDocument.uri} (cached)`);
    //     return cached;
    // }
    const { uri } = textDocument;
    const doc = globalData.documents.getDocument(uri);
    if (!doc) {
        console.log(`[semanticTokensService] ${textDocument.uri} (no document)`);
        return null as unknown as SemanticTokens; // the lsp spec allows null to be returned, but the typescript types don't. this should hopefully be fixed soon
    }
    const { highlights  } = doc;

    if (PARSE_QUEUE.size > 0) {
        // hasn't been parsed yet
        return null as unknown as SemanticTokens; // refer to above comment
    }

    console.log(`Processing ${highlights.length} highlights`);
    // console.time(`[semanticTokensService] ${textDocument.uri} (sort)`);
    highlights.sort((a, b) => a.range.start.compareTo(b.range.start));
    // console.timeEnd(`[semanticTokensService] ${textDocument.uri} (sort)`);

    let lastLine = 0;
    let lastChar = 0;
    const tokens = new Array(highlights.length * 5);
    let tokenIndex = 0;

    // console.time(`[semanticTokensService] ${textDocument.uri} (converting to int array)`);
    for (let i = 0; i < highlights.length; i++) {
        const highlight = highlights[i];
        // console.time(`[semanticTokensService] ${textDocument.uri} (converting to int array) calculating line`);
        const line = highlight.range.start.line - lastLine;
        // console.timeEnd(`[semanticTokensService] ${textDocument.uri} (converting to int array) calculating line`);
        // console.time(`[semanticTokensService] ${textDocument.uri} (converting to int array) calculating char`);
        const char = line === 0 ? highlight.range.start.character - lastChar : highlight.range.start.character;
        // console.timeEnd(`[semanticTokensService] ${textDocument.uri} (converting to int array) calculating char`);
        // console.time(`[semanticTokensService] ${textDocument.uri} (converting to int array) calculating length`);
        const length = highlight.range.end.character - highlight.range.start.character;
        // console.timeEnd(`[semanticTokensService] ${textDocument.uri} (converting to int array) calculating length`);
        // console.time(`[semanticTokensService] ${textDocument.uri} (converting to int array) calculating type`);
        const type = highlight.getColorIndex();
        // console.timeEnd(`[semanticTokensService] ${textDocument.uri} (converting to int array) calculating type`);
        // console.time(`[semanticTokensService] ${textDocument.uri} (converting to int array) pushing to array`);
        tokens[tokenIndex++] = line;
        tokens[tokenIndex++] = char;
        tokens[tokenIndex++] = length;
        tokens[tokenIndex++] = type;
        tokens[tokenIndex++] = 0;
        lastLine = highlight.range.start.line;
        lastChar = highlight.range.start.character;
        // console.timeEnd(`[semanticTokensService] ${textDocument.uri} (converting to int array) pushing to array`);
        // add console times to see how much time is spent in each step
    }
    // console.timeEnd(`[semanticTokensService] ${textDocument.uri} (converting to int array)`);

    // SEMANTIC_TOKEN_CACHE.set(uri, { data: tokens });
    return { data: tokens };
};
