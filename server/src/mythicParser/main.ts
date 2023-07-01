import { CustomRange } from "../utils/positionsAndRanges.js";
import { DocumentInfo } from "../yaml/parser/documentInfo.js";
import { Parser } from "./parser.js";
import { Expr } from "./parserExpressions.js";
import { MythicScanner } from "./scanner.js";

export function getAst(doc: DocumentInfo, initialOffset: number, source: string) {
    return new Parser(new MythicScanner(doc, initialOffset, source).scanTokens()).parseMythicSkill();
}
