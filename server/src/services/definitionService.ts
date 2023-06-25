import { DefinitionParams, Location } from "vscode-languageserver/node.js";
import { globalData } from "../documentManager.js";
import { p } from "../utils/positionsAndRanges.js";
import { filterMap } from "../utils/utils.js";
import { Optional } from "tick-ts-utils";

export default ({ position, textDocument, partialResultToken, workDoneToken }: DefinitionParams): Location[] => {
    const { uri } = textDocument;
    console.log(`[definitionService] ${uri}`);
    const doc = globalData.documents.getDocument(uri);
    if (!doc) {
        console.log(`[definitionService] ${uri} (no document)`);
        return [];
    }
    const { gotoDefinitions } = doc;
    console.log(`[definitionService] ${uri} (found ${gotoDefinitions.length} definitions)`);
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
