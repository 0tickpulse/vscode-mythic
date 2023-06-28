import { ColorPresentation, ColorPresentationParams } from "vscode-languageserver";
import { globalData } from "../documentManager.js";

export default ({ textDocument, color }: ColorPresentationParams): ColorPresentation[] => {
    console.log(`[colorPresentationService] ${textDocument.uri}`);
    const doc = globalData.documents.getDocument(textDocument.uri);
    if (!doc) {
        return [];
    }
    return doc.colorHints.map(h => h.applyTextEdit(color));
};
