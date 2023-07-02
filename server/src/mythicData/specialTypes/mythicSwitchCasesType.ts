import { Position } from "vscode-languageserver-textdocument";
import { Parser } from "../../mythicParser/parser.js";
import { Expr, GenericStringExpr, InlineSkillExpr, MlcValueExpr } from "../../mythicParser/parserExpressions.js";
import { MythicScanner, MythicToken } from "../../mythicParser/scanner.js";
import { MFMythicSkill, MFMythicSkillParser } from "./mythicSkillType.js";
import { InvalidFieldValueError, MythicFieldType } from "../types.js";
import { DocumentInfo } from "../../yaml/parser/documentInfo.js";
import { SyntaxError } from "../../errors.js";
import { Highlight } from "../../colors.js";
import { SemanticTokenTypes } from "vscode-languageserver";

class SwitchCasesExpr {
    constructor(parser: Parser, start: Position, readonly cases: [MythicToken, GenericStringExpr, MythicToken, MythicToken | InlineSkillExpr][]) {}
}

export class MFSwitchCasesParser extends MFMythicSkillParser {
    switchCases() {
        // syntax:
        // ("case" GenericString "=" MythicSkill)*

        const cases: [MythicToken, GenericStringExpr, MythicToken, MythicToken | InlineSkillExpr][] = [];
        while (!this.isAtEnd()) {
            // optional whitespace
            this.consumeWhitespace();
            // "case"
            const caseKeyword = this.consume("Identifier", "Expected 'case'!");
            // optional whitespace
            this.consumeWhitespace();
            // GenericString
            const genericString = this.genericString(["Equal"], "Requires a case!");
            // optional whitespace
            this.consumeWhitespace();
            // "="
            const equal = this.consume("Equal", "Expected '='!");
            // optional whitespace
            this.consumeWhitespace();
            // MythicSkill
            const mythicSkill = this.mythicSkill();
            this.consumeWhitespace();

            cases.push([caseKeyword, genericString, equal, mythicSkill]);
        }
        return new SwitchCasesExpr(this, this.currentPosition(), cases);
    }
}

export class MFSwitchCases extends MythicFieldType {
    constructor() {
        super();
        this.setName("switchCases");
    }
    override validate(doc: DocumentInfo, value: MlcValueExpr): Expr[] {
        const str = value.getSource();
        const scanner = new MythicScanner(doc, value.range.start.toOffset(doc.lineLengths), str);
        const tokens = scanner.scanTokens();
        let expr: SwitchCasesExpr;
        try {
            expr = new MFSwitchCasesParser(tokens).switchCases();
        } catch (e) {
            if (e instanceof SyntaxError) {
                doc.addError(e);
            }
            return [];
        }
        const cases: string[] = []; // to check for duplicates
        const toVisit: Expr[] = [];
        for (const [caseKeyword, genericString, equal, mythicSkill] of expr.cases) {
            if (caseKeyword.lexeme !== "case") {
                doc.addError(new InvalidFieldValueError("Expected 'case'!", value, caseKeyword.range));
            } else {
                doc.addHighlight(new Highlight(caseKeyword.range, SemanticTokenTypes.keyword));
            }
            const caseStr = genericString.value();
            if (cases.includes(caseStr)) {
                doc.addError(new InvalidFieldValueError(`Duplicate case '${caseStr}'!`, value, genericString.range));
            } else {
                cases.push(caseStr);
            }
            if (caseStr.toLowerCase() === "default") {
                doc.addHighlight(new Highlight(genericString.range, SemanticTokenTypes.keyword));
            } else {
                doc.addHighlight(new Highlight(genericString.range, SemanticTokenTypes.string));
            }
            doc.addHighlight(new Highlight(equal.range, SemanticTokenTypes.operator));
            if (mythicSkill instanceof InlineSkillExpr) {
                MFMythicSkill.validateInlineSkill(doc, value, mythicSkill);
                toVisit.push(mythicSkill);
            } else {
                MFMythicSkill.validateSkillName(doc, value, mythicSkill);
            }
        }
        return toVisit;
    }
}
