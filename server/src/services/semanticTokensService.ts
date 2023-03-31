import { SemanticTokens, SemanticTokensParams } from "vscode-languageserver";
import { documents } from "../documentManager.js";
import { Highlight } from "../colors.js";
import { CustomRange, CustomPosition } from "../utils/positionsAndRanges.js";

export default (params: SemanticTokensParams): SemanticTokens => {
    console.log(`[semanticTokensService] ${params.textDocument.uri}`)
    const { uri } = params.textDocument;
    const doc = documents.getDocument(uri);
    if (!doc) {
        return { data: [] };
    }
    const { highlights } = doc;
    const source = doc.base.getText();
    const getRangeText = memoize((range: CustomRange) => range.getFrom(source));

    console.time(`[semanticTokensService] ${params.textDocument.uri} (processedHighlights)`)
    const processedHighlights: Highlight[] = [];
    highlights.forEach((highlight) => {
        const lines = getRangeText(highlight.range).split(/\r?\n/);
        if (lines.length === 1) {
            processedHighlights.push(highlight);
            return;
        }

        const newHighlights: Highlight[] = [];
        let lastChar = highlight.range.start.character;
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length;
            const range = new CustomRange(
                new CustomPosition(highlight.range.start.line + i, lastChar),
                new CustomPosition(highlight.range.start.line + i, lastChar + lineLength),
            );
            newHighlights.push(new Highlight(range, highlight.color));
            lastChar = 0;
        }
        processedHighlights.push(...newHighlights);
    });
    console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (processedHighlights)`)
    console.time(`[semanticTokensService] ${params.textDocument.uri} (sort)`)
    processedHighlights.sort((a, b) => a.range.start.compareTo(b.range.start));
    console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (sort)`)

    let lastLine = 0;
    let lastChar = 0;
    const tokens = new Array(processedHighlights.length * 5);
    let tokenIndex = 0;

    console.time(`[semanticTokensService] ${params.textDocument.uri} (converting to int array)`)
    processedHighlights.forEach((highlight) => {
        const line = highlight.range.start.line - lastLine;
        const char = line === 0 ? highlight.range.start.character - lastChar : highlight.range.start.character;
        const length = getRangeText(highlight.range).length;
        const type = highlight.getColorIndex();
        const modifiers = 0;
        tokens[tokenIndex++] = line;
        tokens[tokenIndex++] = char;
        tokens[tokenIndex++] = length;
        tokens[tokenIndex++] = type;
        tokens[tokenIndex++] = modifiers;
        lastLine = highlight.range.start.line;
        lastChar = highlight.range.start.character;
    });
    console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (converting to int array)`)

    return { data: tokens };
};
function memoize<T extends Function>(fn: T): T {
    const cache = new Map();
    return ((...args: any[]) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    }) as unknown as T;
}
