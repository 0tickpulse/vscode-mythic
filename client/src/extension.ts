// The module 'vscode' contains the VS Code extensibility API

import { join } from "path";
import { ExtensionContext, Range, Position, TextEditor, window, workspace } from "vscode";
import { LanguageClientOptions, LanguageClient, TransportKind, ServerOptions } from "vscode-languageclient/node.js";

let client: LanguageClient;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    const serverModule = context.asAbsolutePath(join("out", "server.js"));
    log(`Attempting to start server from ${serverModule}...`);
    const debugOptions = { execArgv: ["--nolazy"] };
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

    client = new LanguageClient("mythicLanguageServer", "Mythic Language Server", serverOptions, clientOptions);

    client.start();
    log("Server started!");
    context.subscriptions.push(
        client.onRequest("vscode-mythic/highlight", (highlights: Highlight[]) => {
            log(`Received highlight request from server...`);
            highlights.forEach((highlight) => {
                const range = new Range(
                    new Position(highlight.range.start.line, highlight.range.start.character),
                    new Position(highlight.range.end.line, highlight.range.end.character),
                );
                const decorationType = window.createTextEditorDecorationType({
                    color: highlight.color,
                });
                const decoration = { range };
                window.activeTextEditor?.setDecorations(decorationType, [decoration]);
            });
        }),
        client,
    );
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
