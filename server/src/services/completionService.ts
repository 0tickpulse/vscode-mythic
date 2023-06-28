import { CompletionItem, CompletionList, CompletionParams } from "vscode-languageserver";
import { globalData } from "../documentManager.js";
import { autoComplete, postParse, preParse } from "../yaml/parser/parseSync.js";
import { p } from "../utils/positionsAndRanges.js";

export default ({ textDocument, position, }: CompletionParams): CompletionItem[] | null => {
    console.log(`[completionService] ${textDocument.uri}`);
    const doc = globalData.documents.getDocument(textDocument.uri);
    if (!doc) {
        console.log(`[completionService] ${textDocument.uri} (no document)`);
        return null;
    }
    autoComplete(doc, p(position));
    return doc.autoCompletions;
}
