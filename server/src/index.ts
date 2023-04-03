import { ProposedFeatures, SemanticTokenTypes, createConnection } from "vscode-languageserver/node.js";
import { documents } from "./documentManager.js";
import didChangeContentService from "./services/didChangeContentService.js";
import initializeService from "./services/initializeService.js";
import { hover } from "./services/hoverService.js";
import semanticTokensService from "./services/semanticTokensService.js";
import { stripIndentation } from "tick-ts-utils";

process.argv.push("--node-ipc")

export const server = {
    connection: createConnection(ProposedFeatures.all),
    documents,
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
        documents: { manager },
    } = server;
    console.log(`Successfully connected!`);
    console.log(stripIndentation`Mythic Language Server
        Node Version: ${process.version}
        Listening to client requests...`);
    connection.listen();
    connection.onInitialize(initializeService);
    connection.onHover(hover);
    connection.languages.semanticTokens.on(semanticTokensService);

    manager.onDidChangeContent(wrapInTryCatch(didChangeContentService, undefined));
    manager.onDidOpen(didChangeContentService);
    // manager.onDidSave(didChangeContentService);
    manager.listen(server.connection);
}

if (require.main === module) {
    main();
}
