import { Range } from "vscode-languageserver-textdocument";
import { MythicToken } from "./mythicParser/scanner.js";
import { Expr, GenericStringExpr, MechanicExpr, MlcPlaceholderExpr, MlcValueExpr, SkillLineExpr } from "./mythicParser/parserExpressions.js";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node.js";
import { getClosestTo } from "./utils/utils.js";
import { CustomRange } from "./utils/positionsAndRanges.js";
import { getClosestMatch } from "./mythicData/services.js";
import { MythicField, MythicFieldType } from "./mythicData/types.js";

export abstract class MythicError extends Error {
    #codeDescription: string | undefined;
    #severity: DiagnosticSeverity = 1;
    constructor(
        public readonly range: CustomRange,
        public readonly source: string,
        public message: string,
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

// SYNTAX ERROR: 1
export class MythicSyntaxError extends MythicError {
    constructor(range: CustomRange, source: string, message: string) {
        super(range, source, message, 1);
    }
}

export class InvalidFieldValueError extends MythicError {
    constructor(source: string, message: string, public field: MythicFieldType, expr: MlcValueExpr , range = expr.range) {
        super(range, source, message, 2);
    }
}

export class UnknownMechanicError extends MythicError {
    constructor(source: string, mechanic: MechanicExpr, skill?: SkillLineExpr) {
        const value = mechanic.identifier.value();
        let message = `Unknown mechanic '${value}'`;
        const closest = getClosestMatch("mechanic", value);
        if (closest !== undefined) {
            message += `. Did you mean '${closest}'?`;
        }
        const range = mechanic.identifier.range;
        super(range, source, message, 3);
        this.setCodeDescription("unknown-mechanic");
        this.setSeverity(DiagnosticSeverity.Error);
    }
}
