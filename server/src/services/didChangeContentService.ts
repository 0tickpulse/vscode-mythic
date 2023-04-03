import { TextDocumentChangeEvent } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "../yaml/parser/parser.js";
import { documents } from "../documentManager.js";
import { server } from "../index.js";

// let ratelimitEnd: number | null = null;

export default async (params: TextDocumentChangeEvent<TextDocument>) => {
    console.log(`[didChangeContentService] ${params.document.uri}`);

    // if (ratelimitEnd !== null && Date.now() < ratelimitEnd) {
    //     return;
    // }

    // ratelimitEnd = Date.now() + 1000;

    const current = Date.now();
    (await parse(params.document)).ifOkOrElse((info) => {
        if (info.lastUpdate !== current) {
            // this means that the document has been updated since this parse started and we should ignore it
            return;
        }
        documents.set(info);
        server.connection.sendDiagnostics({ uri: params.document.uri, diagnostics: info.errors });
    }, (e) => {
        console.log((e as any).stack);
    });
};
