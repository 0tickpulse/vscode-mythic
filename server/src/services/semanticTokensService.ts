import { SemanticTokens, SemanticTokensParams } from "vscode-languageserver";
import { documents } from "../documentManager.js";
import { Highlight } from "../colors.js";
import { CustomRange, CustomPosition } from "../utils/positionsAndRanges.js";

export default (params: SemanticTokensParams): SemanticTokens => {
    console.log(`[semanticTokensService] ${params.textDocument.uri}`);
    const { uri } = params.textDocument;
    const doc = documents.getDocument(uri);
    if (!doc) {
        return { data: [] };
    }
    const { highlights } = doc;
    const source = doc.base.getText();

    console.log(`Processing ${highlights.length} highlights`);
    console.time(`[semanticTokensService] ${params.textDocument.uri} (sort)`);
    highlights.sort((a, b) => a.range.start.compareTo(b.range.start));
    console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (sort)`);

    let lastLine = 0;
    let lastChar = 0;
    const tokens = new Array(highlights.length * 5);
    let tokenIndex = 0;

    console.time(`[semanticTokensService] ${params.textDocument.uri} (converting to int array)`);
    highlights.forEach((highlight) => {
        console.time(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) calculating line`);
        const line = highlight.range.start.line - lastLine;
        console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) calculating line`);
        console.time(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) calculating char`);
        const char = line === 0 ? highlight.range.start.character - lastChar : highlight.range.start.character;
        console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) calculating char`);
        console.time(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) calculating length`);
        const length = highlight.range.getFrom(source).length;
        console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) calculating length`);
        console.time(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) calculating type`);
        const type = highlight.getColorIndex();
        console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) calculating type`);
        console.time(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) pushing to array`);
        tokens[tokenIndex++] = line;
        tokens[tokenIndex++] = char;
        tokens[tokenIndex++] = length;
        tokens[tokenIndex++] = type;
        tokens[tokenIndex++] = 0;
        lastLine = highlight.range.start.line;
        lastChar = highlight.range.start.character;
        console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (converting to int array) pushing to array`);
        // add console times to see how much time is spent in each step
    });
    console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (converting to int array)`);

    return { data: tokens };
};
