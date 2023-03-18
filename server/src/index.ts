import { ProposedFeatures, createConnection } from "vscode-languageserver/node.js";
import { documents } from "./documentManager.js";
import didChangeContentService from "./services/didChangeContentService.js";
import initializeService from "./services/initializeService.js";
import syntaxHighlightService from "./services/syntaxHighlightService.js";
import { hover } from "./services/hoverService.js";

export const server = {
    connection: createConnection(ProposedFeatures.all),
    documents,
};

function main() {
    const {
        connection,
        documents: { manager },
    } = server;
    console.log(`Successfully connected!`);
    connection.listen();
    connection.onInitialize(initializeService);
    connection.onRequest("vscode-mythic/highlight", syntaxHighlightService);
    connection.onHover(hover);
    manager.onDidChangeContent(didChangeContentService);
    manager.listen(server.connection);
}

if (require.main === module) {
    main();
}
