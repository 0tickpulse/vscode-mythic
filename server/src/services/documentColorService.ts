import { ColorInformation, DocumentColorParams } from "vscode-languageserver";
import { globalData } from "../documentManager.js";

export default (params: DocumentColorParams): ColorInformation[] => {
    console.log(`[documentColorService] ${params.textDocument.uri}`);
    const doc = globalData.documents.getDocument(params.textDocument.uri);
    if (!doc) {
        return [];
    }
    return doc.colorHints;
}
