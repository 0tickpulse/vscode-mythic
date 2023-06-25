import { TextDocumentChangeEvent } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { queueDocumentForParse } from "../yaml/parser/parseSync.js";

// let ratelimitEnd: number | null = null;

export default async ({ document }: TextDocumentChangeEvent<TextDocument>) => {
    console.log(`[didChangeContentService] ${document.uri}`);
    // ratelimitEnd = Date.now() + 1000;
    queueDocumentForParse(document);
};
