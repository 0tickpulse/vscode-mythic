import { DefinitionParams, Location } from "vscode-languageserver/node.js";
import { globalData } from "../documentManager.js";
import { p } from "../utils/positionsAndRanges.js";
import { filterMap } from "../utils/utils.js";
import { Optional } from "tick-ts-utils";
import { logEvent } from "../utils/logging.js";

export default ({ position, textDocument }: DefinitionParams): Location[] => {
    const { uri } = textDocument;
    logEvent("definitionService", textDocument);
    const doc = globalData.documents.getDocument(uri);
    if (!doc) {
        logEvent("definitionService", textDocument, "(no document)");
        return [];
    }
    const { gotoDefinitions } = doc;
    logEvent("definitionService", textDocument, `(found ${gotoDefinitions.length} definitions)`);
    return filterMap(gotoDefinitions, ({ fromRange, targetDoc, targetRange }) => {
        if (!fromRange.contains(p(position))) {
            return Optional.empty();
        }
        return Optional.of({
            uri: targetDoc.base.uri,
            range: targetRange,
        });
    });
};
