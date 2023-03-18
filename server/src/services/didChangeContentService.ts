import { TextDocumentChangeEvent } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "../yaml/parser/parser.js";
import { documents } from "../documentManager.js";
import { server } from "../index.js";

export default (params: TextDocumentChangeEvent<TextDocument>) => {
    console.log(`[didChangeContentService] ${params.document.uri}`);
    console.log(`New contents:\n${params.document.getText()}`);
    const info = parse(params.document);
    documents.set(info);
    server.connection.sendDiagnostics({ uri: params.document.uri, diagnostics: info.errors });
    console.log(`Sending highlight request to client...`);
    server.connection.sendRequest(
        "vscode-mythic/highlight",
        info.compileHighlights().map((highlight) => ({ ...highlight, color: highlight.color.toCss() })) ?? [],
    );
};
