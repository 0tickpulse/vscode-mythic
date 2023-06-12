import { InitializeResult } from "vscode-languageserver";
import { SEMANTIC_TOKEN_TYPES } from "../colors.js";
import { scheduleParse } from "../yaml/parser/parseSync.js";
import { server } from "../index.js";

export default (): InitializeResult => {
    scheduleParse();

    return {
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
                    tokenModifiers: [],
                },
            },
        },
    };
};
