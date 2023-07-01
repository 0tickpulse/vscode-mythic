import { SemanticTokenTypes } from "vscode-languageserver";
import { Highlight } from "../../colors.js";
import { Parser } from "../../mythicParser/parser.js";
import { Expr, InlineSkillExpr, MlcValueExpr, SkillLineExpr } from "../../mythicParser/parserExpressions.js";
import { MythicScanner, MythicToken } from "../../mythicParser/scanner.js";
import { DocumentInfo, RangeLink } from "../../yaml/parser/documentInfo.js";
import { generateHover, getHolderFromName } from "../services.js";
import { InvalidFieldValueError, MythicFieldType } from "../types.js";
import { dbg } from "../../utils/logging.js";
import { SyntaxError } from "../../errors.js";

class MFMythicSkillParser extends Parser {
    parse() {
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
    override validate(doc: DocumentInfo, value: MlcValueExpr): Expr[] {
        const str = value.getSource();
        dbg("mythicSkill", "Validating", {
            str,
            range: value.range,
        });
        const scanner = new MythicScanner(doc, value.range.start.toOffset(doc.lineLengths), str);
        const tokens = scanner.scanTokens();
        let expr: InlineSkillExpr | MythicToken;
        try {
            expr = new MFMythicSkillParser(tokens).parse();
        } catch (e) {
            if (e instanceof SyntaxError) {
                doc.addError(e);
            }
            return [];
        }
        if (expr instanceof InlineSkillExpr) {
            return [expr];
        }
        const mechanicName = expr.lexeme;
        const holder = getHolderFromName("mechanic", "skill:" + mechanicName);
        if (holder.isPresent()) {
            const h = holder.get();
            if (h.definition) {
                doc.addHover({
                    ...generateHover("mechanic", mechanicName, h),
                    range: value.range,
                });
                doc.addGotoDefinitionAndReverseReference(new RangeLink(value.range, h.definition.range, h.definition.doc));
                doc.addHighlight(new Highlight(value.range, SemanticTokenTypes.function));
                return [];
            }
        }

        doc.addError(new InvalidFieldValueError(`Unknown metaskill '${mechanicName}'`, value));

        return [];
    }
}
