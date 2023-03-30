import { InitializeResult } from "vscode-languageserver";
import { SEMANTIC_TOKEN_TYPES } from "../colors.js";

export default (): InitializeResult => ({
    capabilities: {
        hoverProvider: true,
        completionProvider: {
            resolveProvider: true,
            triggerCharacters: ["@", "?", "~"],
        },
        semanticTokensProvider: {
            full: true,
            range: false,
            legend: {
                tokenTypes: SEMANTIC_TOKEN_TYPES,
                tokenModifiers: []
            },
        }
    },
});
