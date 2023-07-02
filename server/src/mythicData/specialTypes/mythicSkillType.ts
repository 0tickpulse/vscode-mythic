import { SemanticTokenTypes } from "vscode-languageserver";
import { Highlight } from "../../colors.js";
import { Parser } from "../../mythicParser/parser.js";
import { Expr, InlineSkillExpr, MlcValueExpr, SkillLineExpr } from "../../mythicParser/parserExpressions.js";
import { MythicScanner, MythicToken } from "../../mythicParser/scanner.js";
import { DocumentInfo, RangeLink } from "../../yaml/parser/documentInfo.js";
import { generateHover, getHolderFromName } from "../services.js";
import { InvalidFieldValueError, MythicFieldType } from "../types.js";
import { SyntaxError } from "../../errors.js";

export class MFMythicSkillParser extends Parser {
    mythicSkill() {
        if (this.match("Identifier")) {
            return this.previous();
        }
        this.consume("LeftSquareBracket", "Expected '[' before inline skill!");
        const leftSquareBracket = this.previous();
        const dashesAndSkills: [MythicToken, SkillLineExpr][] = [];
        while (!this.check("RightSquareBracket") && !this.isAtEnd()) {
            // this.#completionGeneric(["- ", "]"]);
            // optional whitespace
            this.consumeWhitespace();
            // this.#completionGeneric(["- ", "]"]);
            // dash
            const dash = this.consume("Dash", "Expected '-' after '['!");

            // optional whitespace
            this.consumeWhitespace();
            // skill
            const skill = this.skillLine("RightSquareBracket", "Dash");

            // optional whitespace
            this.consumeWhitespace();
            dashesAndSkills.push([dash, skill]);
        }
        const rightSquareBracket = this.consume("RightSquareBracket", "Expected ']' after inline skill!");
        return new InlineSkillExpr(this, this.currentPosition(), leftSquareBracket, dashesAndSkills, rightSquareBracket);
    }
}

export class MFMythicSkill extends MythicFieldType {
    constructor() {
        super();
        this.setName("mythicSkill");
    }
    static validateSkillName(doc: DocumentInfo, value: MlcValueExpr, identifier: MythicToken) {
        const mechanicName = identifier.lexeme;
        const holder = getHolderFromName("mechanic", "skill:" + mechanicName);
        if (holder.isPresent()) {
            const h = holder.get();
            if (h.definition) {
                doc.addHover({
                    ...generateHover("mechanic", mechanicName, h),
                    range: identifier.range,
                });
                doc.addGotoDefinitionAndReverseReference(new RangeLink(identifier.range, h.definition.range, h.definition.doc));
                doc.addHighlight(new Highlight(identifier.range, SemanticTokenTypes.function));
                return [];
            }
        }

        doc.addError(new InvalidFieldValueError(`Unknown metaskill '${mechanicName}'`, value, identifier.range));
    }
    static validateInlineSkill(doc: DocumentInfo, value: MlcValueExpr, inlineSkill: InlineSkillExpr) {
        // nothing for now
    }

    override validate(doc: DocumentInfo, value: MlcValueExpr): Expr[] {
        const str = value.getSource();
        const scanner = new MythicScanner(doc, value.range.start.toOffset(doc.lineLengths), str);
        const tokens = scanner.scanTokens();
        let expr: InlineSkillExpr | MythicToken;
        try {
            expr = new MFMythicSkillParser(tokens).mythicSkill();
        } catch (e) {
            if (e instanceof SyntaxError) {
                doc.addError(e);
            }
            return [];
        }
        if (expr instanceof InlineSkillExpr) {
            MFMythicSkill.validateInlineSkill(doc, value, expr);
            return [expr];
        }

        MFMythicSkill.validateSkillName(doc, value, expr);

        return [];
    }
}
