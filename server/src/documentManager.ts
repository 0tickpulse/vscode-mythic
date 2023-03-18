import { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentInfo } from "./yaml/parser/parser.js";

export const documents = {
    manager: new TextDocuments(TextDocument),
    list: [] as DocumentInfo[],
    getDocument(uri: string) {
        return this.list.find((document) => document.base.uri === uri) ?? void console.log(`[documentManager] Document not found: ${uri}`);
    },
    set(doc: DocumentInfo) {
        if (this.list.some(document => document.base.uri === doc.base.uri)) {
            this.list = this.list.map(document => document.base.uri === doc.base.uri ? doc : document);
            return;
        }

        this.list.push(doc);
    }
};
