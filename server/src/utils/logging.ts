import { Color, codes } from "tick-ts-utils";
import { format } from "util";
import { TextDocumentIdentifier } from "vscode-languageserver";

function fmtLog(str: string, color: Color) {
    return `[${new Date().toLocaleTimeString()}] ` + color.toAnsiColorCode() + str + codes.reset;
}

export function info<T extends unknown[]>(prefix = "Mythic Language Server", ...args: T): T {
    console.log(fmtLog(format(`[${prefix}: INFO]`, ...args), Color.parseHex("#55FF55").get()));
    return args;
}

export function warn<T extends unknown[]>(prefix = "Mythic Language Server", ...args: T): T {
    console.log(fmtLog(format(`[${prefix}: WARN]`, ...args), Color.parseHex("#FFFF55").get()));
    return args;
}

export function logEvent<T extends unknown[]>(event: string, textDocument: TextDocumentIdentifier, ...args: T) {
    info(event, `${textDocument.uri} ${format(...args)}`);
}
