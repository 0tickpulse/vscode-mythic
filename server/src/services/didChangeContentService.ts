import { TextDocumentChangeEvent } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "../yaml/parser/parser.js";
import { documents } from "../documentManager.js";
import { server } from "../index.js";

export default async (params: TextDocumentChangeEvent<TextDocument>) => {
    console.log(`[didChangeContentService] ${params.document.uri}`);
    console.log(`New contents:\n${params.document.getText()}`);
    const info = parse(params.document);
    documents.set(info);
    server.connection.sendDiagnostics({ uri: params.document.uri, diagnostics: info.errors });
    console.log(`Sending highlight request to client...`);
    // delay
    // await new Promise((resolve) => setTimeout(resolve, 5));

    console.log(`Highlights:\n${info.highlights.map((h) => `${h.range} ${h.color.toCss()}`).join("\n")}`);
    server.connection.sendRequest(
        "vscode-mythic/highlight",
        info.highlights.map((highlight) => ({ ...highlight, color: highlight.color.toCss() })) ?? [],
    );
};
