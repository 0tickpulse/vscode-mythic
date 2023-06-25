import { ProposedFeatures, SemanticTokenTypes, createConnection } from "vscode-languageserver/node.js";
import { globalData } from "./documentManager.js";
import didChangeContentService from "./services/didChangeContentService.js";
import initializeService from "./services/initializeService.js";
import { hover } from "./services/hoverService.js";
import semanticTokensService from "./services/semanticTokensService.js";
import { stripIndentation } from "tick-ts-utils";
import { scheduleParse } from "./yaml/parser/parseSync.js";
import definitionService from "./services/definitionService.js";
import referenceService from "./services/referenceService.js";

process.argv.push("--node-ipc");

export const server = {
    connection: createConnection(ProposedFeatures.all),
    data: globalData,
};

function wrapInTryCatch<T>(fn: (...args: any[]) => T, fallback: T) {
    try {
        return fn;
    } catch (e) {
        console.error(e);
        return () => fallback;
    }
}

function main() {
    const {
        connection,
        data: {
            documents: { manager },
        },
    } = server;
    connection.listen();
    connection.onInitialize(initializeService);
    connection.onHover(hover);
    connection.languages.semanticTokens.on(semanticTokensService);
    connection.onDefinition(definitionService);
    connection.onReferences(referenceService);

    manager.onDidChangeContent(wrapInTryCatch(didChangeContentService, undefined));
    manager.onDidOpen(didChangeContentService);
    // manager.onDidSave(didChangeContentService);
    manager.listen(server.connection);
}

if (require.main === module) {
    main();
}
