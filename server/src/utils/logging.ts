import { appendFile } from "fs";
import { Color, codes } from "tick-ts-utils";
import { format } from "util";
import { TextDocumentIdentifier } from "vscode-languageserver";

let prevTime = Date.now();

function fmtLog(str: string, color: Color) {
    const now = Date.now();
    const diff = now - prevTime;
    prevTime = now;
    return `[${ new Date().toLocaleTimeString() }] ` + color.toAnsiColorCode() + str + codes.reset + ` (${ diff }ms)`;
}

export function info<T extends unknown[]>(prefix = "Mythic Language Server", ...args: T): T {
    console.log(fmtLog(format(`[${prefix}: INFO]`, ...args), Color.parseHex("#55FF55").get()));
    return args;
}

export function warn<T extends unknown[]>(prefix = "Mythic Language Server", ...args: T): T {
    console.log(fmtLog(format(`[${prefix}: WARN]`, ...args), Color.parseHex("#FFFF55").get()));
    return args;
}

export function dbg<T extends unknown[]>(prefix = "Mythic Language Server", ...args: T): T {
    console.log(fmtLog(format(`[${prefix}: DEBUG]`, ...args), Color.parseHex("#55FFFF").get()));
    return args;
}

export function logEvent<T extends unknown[]>(event: string, textDocument: TextDocumentIdentifier, ...args: T) {
    info(event, `${textDocument.uri} ${format(...args)}`);
}
