import { ColorInformation, DocumentColorParams } from "vscode-languageserver";
import { globalData } from "../documentManager.js";
import { logEvent } from "../utils/logging.js";

export default ({ textDocument }: DocumentColorParams): ColorInformation[] => {
    logEvent("documentColorService", textDocument);
    const doc = globalData.documents.getDocument(textDocument.uri);
    if (!doc) {
        return [];
    }
    return doc.colorHints;
};
