import { ProposedFeatures, createConnection } from "vscode-languageserver/node.js";
import { globalData } from "./documentManager.js";
import colorPresentationService from "./services/colorPresentationService.js";
import completionResolveService from "./services/completionResolveService.js";
import completionService from "./services/completionService.js";
import definitionService from "./services/definitionService.js";
import didChangeContentService from "./services/didChangeContentService.js";
import documentColorService from "./services/documentColorService.js";
import { hover } from "./services/hoverService.js";
import initializeService from "./services/initializeService.js";
import referenceService from "./services/referenceService.js";
import semanticTokensService from "./services/semanticTokensService.js";
import { info } from "./utils/logging.js";
import { stdin, stdout } from "process";

const connectionType = process.argv.includes("--stdio") ? "stdio" : "ipc";

export const server = {
    connection: connectionType === "stdio" ? createConnection(process.stdin, process.stdout) : createConnection(ProposedFeatures.all),
    data: globalData,
};

function main() {
    const {
        connection,
        data: {
            documents: { manager },
        },
    } = server;
    info(undefined, "Starting server...");
    info(undefined, `Node Version: ${process.version}`);
    info(undefined, `Command: ${process.argv.join(" ")}`);
    info(undefined, `Connection type: ${connectionType}`)
    connection.listen();
    connection.onInitialize(initializeService);
    connection.onHover(hover);
    connection.languages.semanticTokens.on(semanticTokensService);
    connection.onDefinition(definitionService);
    connection.onReferences(referenceService);
    connection.onCompletion(completionService);
    connection.onCompletionResolve(completionResolveService);
    connection.onDocumentColor(documentColorService);
    connection.onColorPresentation(colorPresentationService);

    manager.onDidChangeContent(didChangeContentService);
    manager.listen(server.connection);
}

if (require.main === module) {
    main();
}
