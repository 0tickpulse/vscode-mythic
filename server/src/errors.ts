import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node.js";
import { MythicFieldType } from "./mythicData/types.js";
import { Expr, MlcValueExpr, SkillLineExpr } from "./mythicParser/parserExpressions.js";
import { MythicToken } from "./mythicParser/scanner.js";
import { CustomRange } from "./utils/positionsAndRanges.js";

export class SyntaxError extends Error {
    #codeDescription: string | undefined;
    #severity: DiagnosticSeverity = 1;
    constructor(
        public readonly range: CustomRange,
        public readonly source: string,
        public message: string,
        public readonly token?: MythicToken,
        public readonly code = 0,
    ) {
        super();
    }
    toDiagnostic(): Diagnostic {
        const diagnostic: Diagnostic = {
            message: this.message,
            range: this.range,
            severity: this.#severity,
            code: this.code,
            source: "Mythic Language Server",
        };
        return diagnostic;
    }
    setCodeDescription(description: string) {
        this.#codeDescription = description;
        return this;
    }
    setSeverity(severity: DiagnosticSeverity) {
        this.#severity = severity;
        return this;
    }
}

export class InvalidFieldValueError extends SyntaxError {
    constructor(source: string, message: string, public field: MythicFieldType, expr: MlcValueExpr , range = expr.range, code = 0) {
        super(range, source, message, undefined, code);
    }
}

export class ResolverError extends SyntaxError {
    constructor(source: string, message: string, expr: Expr, range = expr.range, skill?: SkillLineExpr, code = 0) {
        super(range, source, message, undefined, code);
    }
}


