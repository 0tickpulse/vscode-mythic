import { Hover, HoverParams, ServerRequestHandler } from "vscode-languageserver";
import { documents } from "../documentManager.js";
import { p } from "../utils/positionsAndRanges.js";

export const hover: ServerRequestHandler<HoverParams, Hover | null | undefined, never, void> = (params: HoverParams) => {
    const doc = documents.getDocument(params.textDocument.uri);
    if (!doc) {
        return null;
    }
    const hovers = doc.getHoversAt(p(params.position).toOffset(doc.source));
    if (hovers.length === 0) {
        return null;
    }
    return hovers[0].toHover(doc.source);
};
