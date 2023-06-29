import { Location, ReferenceParams } from "vscode-languageserver/node.js";
import { globalData } from "../documentManager.js";
import { filterMap } from "../utils/utils.js";
import { Optional } from "tick-ts-utils";
import { p } from "../utils/positionsAndRanges.js";
import { logEvent } from "../utils/logging.js";

export default ({ position, textDocument }: ReferenceParams): Location[] => {
    const { uri } = textDocument;
    logEvent("referenceService", textDocument)
    const doc = globalData.documents.getDocument(uri);
    if (!doc) {
        logEvent("referenceService", textDocument, "(no document)");
        return [];
    }
    const { gotoReferences } = doc;
    logEvent("referenceService", textDocument, `(found ${gotoReferences.length} references)`);
    return filterMap(gotoReferences, ({ fromRange, targetDoc, targetRange }) => {
        if (!fromRange.contains(p(position))) {
            return Optional.empty();
        }
        return Optional.of({
            uri: targetDoc.base.uri,
            range: targetRange,
        });
    });
};
