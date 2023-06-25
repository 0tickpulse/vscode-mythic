import { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentInfo } from "./yaml/parser/parser.js";
import { CachedMythicSkill } from "./mythicModels.js";

export const FILE_EXTENSIONS = [".yml", ".yaml", ".mythic"];

export const globalData = {
    documents: {
        manager: new TextDocuments(TextDocument),
        list: new Map<string, DocumentInfo>(),
        getDocument(uri: string) {
            return this.list.get(uri);
        },
        set(doc: DocumentInfo) {
            this.list.set(doc.base.uri, doc);
        },
    },
    mythic: {
        skills: new Set<CachedMythicSkill>(),
    }
};
