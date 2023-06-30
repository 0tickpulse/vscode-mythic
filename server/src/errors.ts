import { Range } from "vscode-languageserver-textdocument";
import { MythicToken } from "./mythicParser/scanner.js";
import { Expr, GenericStringExpr, MechanicExpr, MlcPlaceholderExpr, MlcValueExpr, SkillLineExpr } from "./mythicParser/parserExpressions.js";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node.js";
import { getClosestTo } from "./utils/utils.js";
import { CustomRange } from "./utils/positionsAndRanges.js";
import { getClosestMatch } from "./mythicData/services.js";
import { MythicField, MythicFieldType } from "./mythicData/types.js";

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

export class UnknownMechanicResolverError extends ResolverError {
    constructor(source: string, mechanic: MechanicExpr, skill?: SkillLineExpr) {
        const value = mechanic.identifier.value();
        let message = `Unknown mechanic '${value}'`;
        const closest = getClosestMatch("mechanic", value);
        if (closest !== undefined) {
            message += `. Did you mean '${closest}'?`;
        }
        const range = mechanic.identifier.range;
        super(source, message, mechanic, range, skill, 1);
        this.setCodeDescription("unknown-mechanic");
        this.setSeverity(DiagnosticSeverity.Error);
    }
}
