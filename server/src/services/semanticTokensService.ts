import { SemanticTokens, SemanticTokensParams } from "vscode-languageserver";
import { documents } from "../documentManager.js";
import { Highlight } from "../colors.js";
import { CustomRange, CustomPosition } from "../utils/positionsAndRanges.js";

export default (params: SemanticTokensParams): SemanticTokens => {
    console.log(`[semanticTokensService] ${params.textDocument.uri}`);
    console.time(`[semanticTokensService] ${params.textDocument.uri}`);
    const { uri } = params.textDocument;
    const doc = documents.getDocument(uri);
    if (!doc) {
        return { data: [] };
    }
    const { highlights } = doc;
    const source = doc.base.getText();
    console.time(`[semanticTokensService] ${params.textDocument.uri} (processHighlights)`);
    const processedHighlights = highlights.flatMap((highlight) => {
        // if it spans multiple lines, split it into multiple highlights

        const lines = highlight.range.getFrom(source).split(/\r?\n/);
        const lineCount = lines.length;
        if (lineCount === 1) {
            return [highlight];
        }

        const highlights: Highlight[] = [];
        let lastLine = highlight.range.start.line;
        let lastChar = highlight.range.start.character;
        for (let i = 0; i < lineCount; i++) {
            const line = lines[i];
            const lineLength = line.length;
            const range = new CustomRange(
                new CustomPosition(lastLine, lastChar),
                new CustomPosition(lastLine, lastChar + lineLength),
            );
            highlights.push(new Highlight(range, highlight.color));
            lastLine++;
            lastChar = 0;
        }
        return highlights;

    }).sort((a, b) => a.range.start.compareTo(b.range.start));
    console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (processHighlights)`);

    let lastLine = 0;
    let lastChar = 0;

    // [line, char, length, type, modifiers]
    // line and char are relative to the previous token
    // modifiers is always 0
    console.time(`[semanticTokensService] ${params.textDocument.uri} (map)`);
    const tokens: [number, number, number, number, number][] = processedHighlights.map((highlight) => {
        const line = highlight.range.start.line - lastLine;
        const char = line === 0 ? highlight.range.start.character - lastChar : highlight.range.start.character;
        const length = highlight.range.getFrom(source).length;
        const type = highlight.getColorIndex();
        const modifiers = 0;
        lastLine = highlight.range.start.line;
        lastChar = highlight.range.start.character;
        return [line, char, length, type, modifiers];
    });
    console.timeEnd(`[semanticTokensService] ${params.textDocument.uri} (map)`);
    console.timeEnd(`[semanticTokensService] ${params.textDocument.uri}`);
    return {
        data: tokens.flat(),
    };
};
