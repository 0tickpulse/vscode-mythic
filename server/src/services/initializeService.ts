import { InitializeParams, InitializeResult, ProgressType } from "vscode-languageserver";
import { SEMANTIC_TOKEN_MODIFIERS, SEMANTIC_TOKEN_TYPES } from "../colors.js";
import { server } from "../index.js";
import { queuePartial, scheduleParse } from "../yaml/parser/parseSync.js";
import { URI } from "vscode-uri";
import { isMythicFile, recursive_search as recursiveScanDir } from "../utils/fs.js";
import { join } from "path";
import { TextDocument } from "vscode-languageserver-textdocument";
import { readFile } from "fs/promises";
import { logEvent } from "../utils/logging.js";

export default async (params: InitializeParams): Promise<InitializeResult> => {
    logEvent("initializeService", { uri: "" });
    server.data.documents.manager.all().forEach((doc) => queuePartial(doc));

    const workspace = params.workspaceFolders;
    // server.connection.sendRequest("fullParse/start");
    for (const folder of workspace ?? []) {
        const { uri } = folder;
        const path = URI.parse(uri).fsPath;
        const files = await recursiveScanDir(path);
        await Promise.all(
            files.map(async (file) => {
                if (!isMythicFile(file)) {
                    return;
                }
                const uri = URI.file(file).toString();
                const textdoc = TextDocument.create(uri, "yaml", 0, await readFile(file, "utf-8"));
                queuePartial(textdoc);
            }),
        );
    }
    // server.connection.sendRequest("fullParse/end", {
    //     size: 4
    // });

    scheduleParse();

    return {
        capabilities: {
            hoverProvider: true,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ["@", "?", "~"],
            },
            colorProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            semanticTokensProvider: {
                full: true,
                range: false,
                legend: {
                    tokenTypes: SEMANTIC_TOKEN_TYPES,
                    tokenModifiers: SEMANTIC_TOKEN_MODIFIERS as unknown as string[], // type conversion because we want to convert from a readonly array to a normal array
                },
            },
        },
    };
};
