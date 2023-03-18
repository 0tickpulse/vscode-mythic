import { documents } from "../documentManager.js";

export default (uri: string) => {
    console.log(`[syntaxHighlightService] ${uri}`);
    const doc = documents.getDocument(uri);
    if (!doc) {
        return [];
    }
    return doc.compileHighlights().map((highlight) => ({ ...highlight, color: highlight.color.toCss() })) ?? [];
};
