import { Location, ReferenceParams } from "vscode-languageserver/node.js";
import { globalData } from "../documentManager.js";
import { filterMap } from "../utils/utils.js";
import { Optional } from "tick-ts-utils";
import { p } from "../utils/positionsAndRanges.js";

export default ({ context, position, textDocument }: ReferenceParams): Location[] => {
    const { uri } = textDocument;
    console.log(`[referenceService] ${textDocument.uri}`);
    const doc = globalData.documents.getDocument(uri);
    if (!doc) {
        console.log(`[referenceService] ${uri} (no document)`);
        return [];
    }
    const { gotoReferences } = doc;
    console.log(`[referenceService] ${uri} (found ${gotoReferences.length} references)`);
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
