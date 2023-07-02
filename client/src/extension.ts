// The module 'vscode' contains the VS Code extensibility API

import { join } from "path";
import { ExtensionContext, StatusBarItem, window } from "vscode";
import { ForkOptions, LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node.js";

let client: LanguageClient;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    const serverModule = context.asAbsolutePath(join("server", "dist", "server.js"));
    log(`Mythic Language Client
        Node Version: ${process.version}
        File: ${__filename}`);
    log(`Attempting to start server from '${serverModule}'...`);
    const debugOptions: ForkOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions,
        },
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            {
                scheme: "file",
                language: "yaml",
            },
        ],
    };

    const status = window.createStatusBarItem();
    fullParseDefaultStatus(status);
    status.show();

    client = new LanguageClient("mythicLanguageServer", "Mythic Language Server", serverOptions, clientOptions);
    context.subscriptions.push(status);

    client.start();
    log("Server started!");
}

function fullParseDefaultStatus(status: StatusBarItem) {
    status.text = "Mythic Language Server";
}

export function log(msg: string) {
    console.log(`${new Date().toLocaleTimeString()}: ${msg}`);
}

// This method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
