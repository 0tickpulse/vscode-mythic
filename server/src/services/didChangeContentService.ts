import { TextDocumentChangeEvent } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { queueFull } from "../yaml/parser/parseSync.js";
import { logEvent } from "../utils/logging.js";

export default async ({ document }: TextDocumentChangeEvent<TextDocument>) => {
    logEvent("didChangeContentService", document)
    queueFull(document);
};
