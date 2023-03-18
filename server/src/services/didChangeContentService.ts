import { TextDocumentChangeEvent } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "../yaml/parser/parser.js";
import { documents } from "../documentManager.js";
import { server } from "../index.js";

export default async (params: TextDocumentChangeEvent<TextDocument>) => {
    console.log(`[didChangeContentService] ${params.document.uri}`)
    const info = parse(params.document);
    documents.set(info);
    server.connection.sendDiagnostics({ uri: params.document.uri, diagnostics: info.errors });
};;
