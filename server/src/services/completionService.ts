import { CompletionList, CompletionParams } from "vscode-languageserver";

export default (params: CompletionParams): CompletionList | null => {
    console.log(`[completionService] ${params.textDocument.uri}`);
    return null;
}
