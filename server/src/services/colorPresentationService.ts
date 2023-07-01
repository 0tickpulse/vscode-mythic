import { Optional, deepEquals } from "tick-ts-utils";
import { ColorPresentation, ColorPresentationParams } from "vscode-languageserver";
import { globalData } from "../documentManager.js";
import { logEvent } from "../utils/logging.js";
import { r } from "../utils/positionsAndRanges.js";
import { filterMap } from "../utils/utils.js";

export default ({ textDocument, color, range }: ColorPresentationParams): ColorPresentation[] => {
    logEvent("colorPresentationService", textDocument);
    const doc = globalData.documents.getDocument(textDocument.uri);
    if (!doc) {
        return [];
    }
    return filterMap(doc.colorHints, (h) => {
        const presentation = h.applyTextEdit(color);
        if (!deepEquals(presentation.textEdit?.range, r(range))) {
            return Optional.empty();
        }
        return Optional.of(presentation);
    });
};
