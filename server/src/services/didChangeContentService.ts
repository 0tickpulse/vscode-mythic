import { TextDocumentChangeEvent } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { documents } from "../documentManager.js";
import { server } from "../index.js";
import { parseSync, parseSyncInner } from "../yaml/parser/parseSync.js";
import { parse } from "../yaml/parser/parser.js";

// let ratelimitEnd: number | null = null;

export default async (params: TextDocumentChangeEvent<TextDocument>) => {
    console.log(`[didChangeContentService] ${params.document.uri}`);

    // if (ratelimitEnd !== null && Date.now() < ratelimitEnd) {
    //     return;
    // }

    // ratelimitEnd = Date.now() + 1000;

    //#region Async
    const info = await parse(params.document);
    //#endregion

    // const info = parseSync(params.document);

    documents.set(info);
    server.connection.sendDiagnostics({ uri: params.document.uri, diagnostics: info.errors });
};
