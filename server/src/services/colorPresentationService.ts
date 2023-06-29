import { ColorPresentation, ColorPresentationParams } from "vscode-languageserver";
import { globalData } from "../documentManager.js";
import { logEvent } from "../utils/logging.js";

export default ({ textDocument, color }: ColorPresentationParams): ColorPresentation[] => {
    logEvent("colorPresentationService", textDocument)
    const doc = globalData.documents.getDocument(textDocument.uri);
    if (!doc) {
        return [];
    }
    return doc.colorHints.map(h => h.applyTextEdit(color));
};
