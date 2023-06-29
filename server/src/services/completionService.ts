import { CompletionItem, CompletionList, CompletionParams } from "vscode-languageserver";
import { globalData } from "../documentManager.js";
import { autoComplete, postParse, preParse } from "../yaml/parser/parseSync.js";
import { p } from "../utils/positionsAndRanges.js";
import { logEvent } from "../utils/logging.js";

export default ({ textDocument, position, }: CompletionParams): CompletionItem[] | null => {
    logEvent("completionService", textDocument)
    const doc = globalData.documents.getDocument(textDocument.uri);
    if (!doc) {
        logEvent("completionService", textDocument, "(no document)")
        return null;
    }
    autoComplete(doc, p(position));
    return doc.autoCompletions;
}
