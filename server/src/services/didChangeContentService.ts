import { TextDocumentChangeEvent } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { queueFull } from "../yaml/parser/parseSync.js";

// let ratelimitEnd: number | null = null;
/**
 * When setting the language mode of a document, the client will send an additional request.
 * Hence, when the server requests the client to change the language mode, the server should also add the document to this set.
 * If the server receives a request to change the language mode of a document that is in this set, it should ignore the request.
 */
export const isLanguageModeCaused = new Set<string>();
export default async ({ document }: TextDocumentChangeEvent<TextDocument>) => {
    console.log(`[didChangeContentService] ${document.uri}`);
    // ratelimitEnd = Date.now() + 1000;
    // if (isLanguageModeCaused.has(document.uri)) {
        // isLanguageModeCaused.delete(document.uri);
        // console.log(`[didChangeContentService] ${document.uri} (language mode change)`);
        // return;
    // }
    queueFull(document);
};
