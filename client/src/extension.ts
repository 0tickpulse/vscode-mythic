// The module 'vscode' contains the VS Code extensibility API

import { join, resolve } from "path";
import { ExtensionContext, Range, Position, TextEditor, window, workspace } from "vscode";
import { LanguageClientOptions, LanguageClient, TransportKind, ServerOptions, ForkOptions } from "vscode-languageclient/node.js";

let client: LanguageClient;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    const serverModule = context.asAbsolutePath(join("dist", "server.js"));
    log(`Mythic Language Client
        Node Version: ${process.version}
        File: ${__filename}`)
    log(`Attempting to start server from '${serverModule}'...`);
    const debugOptions: ForkOptions = { execArgv: ["--nolazy"] };
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions,
        },
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "file", language: "mythic" }],
    };

    // log the command that is being run
    log(`Starting server with command: ${serverOptions.run?.module}`);

    client = new LanguageClient("mythicLanguageServer", "Mythic Language Server", serverOptions, clientOptions);

    client.start();
    log("Server started!");
}

export function log(msg: string) {
    console.log(`${new Date().toLocaleTimeString()}: ${msg}`);
}

// This method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}

export type Highlight = {
    color: string;
    range: Range;
};
