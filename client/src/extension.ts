// The module 'vscode' contains the VS Code extensibility API

import { join } from "path";
import { ExtensionContext, StatusBarItem, languages, window, workspace } from "vscode";
import { ForkOptions, LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node.js";
import { URI } from "vscode-uri";

let client: LanguageClient;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    const serverModule = context.asAbsolutePath(join("dist", "server.js"));
    log(`Mythic Language Client
        Node Version: ${process.version}
        File: ${__filename}`);
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
        documentSelector: [
            {
                scheme: "file",
                language: "mythic",
            },
        ],
    };

    // log the command that is being run
    log(`Starting server with command: ${serverOptions.run?.module}`);

    const status = window.createStatusBarItem();
    fullParseDefaultStatus(status);
    status.show();

    client = new LanguageClient("mythicLanguageServer", "Mythic Language Server", serverOptions, clientOptions);
    const changedLanguage = new Set<string>();
    client.onRequest("language/setLanguage", async ({ uri, language }: SetLanguageParams) => {
        const path = URI.parse(uri).fsPath;
        const doc = await workspace.openTextDocument(path);
        if (doc.languageId !== language && !changedLanguage.has(uri)) {
            log(`Setting language for ${uri} to ${language}`);
            changedLanguage.add(uri);
            // languages.setTextDocumentLanguage(doc, language);
        }
    });
    client.onRequest("fullParse/start", () => {
        log("Full workspace parse started!");
        fullParseStartStatus(status);
    });
    client.onRequest("fullParse/end", () => {
        log("Full workspace parse ended!");
        fullParseDefaultStatus(status);
    });
    context.subscriptions.push(status);

    client.start();
    log("Server started!");
}

function fullParseStartStatus(status: StatusBarItem) {
    status.text = "MM: Full workspace parse...";
}

function fullParseDefaultStatus(status: StatusBarItem) {
    status.text = "Mythic Language Server";
}

type SetLanguageParams = {
    uri: string;
    language: string;
};

export function log(msg: string) {
    console.log(`${new Date().toLocaleTimeString()}: ${msg}`);
}

// This method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
