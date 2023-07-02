import { Position, SemanticTokenTypes } from "vscode-languageserver";
import { GenericError } from "../../errors.js";
import { Parser } from "../../mythicParser/parser.js";
import { Expr, InlineSkillExpr, MlcValueExpr } from "../../mythicParser/parserExpressions.js";
import { MythicScanner, MythicToken } from "../../mythicParser/scanner.js";
import { DocumentInfo } from "../../yaml/parser/documentInfo.js";
import { MythicFieldType } from "../types.js";
import { MFMythicSkill, MFMythicSkillParser } from "./mythicSkillType.js";
import { Resolver } from "../../mythicParser/resolver.js";
import { Highlight } from "../../colors.js";

type CommaSeparatedSkill = {
    skill: MythicToken | InlineSkillExpr;
    weight?: MythicToken;
    comma?: MythicToken;
};

class CommaSeparatedSkills {
    constructor(parser: Parser, start: Position, readonly skills: CommaSeparatedSkill[]) {}
}

export class MFCommaSeparatedSkillsParser extends MFMythicSkillParser {
    commaSeparatedSkills(): CommaSeparatedSkills {
        const skills: CommaSeparatedSkill[] = [];
        while (!this.isAtEnd()) {
            // optional whitespace
            this.consumeWhitespace();
            // skill
            const skill = this.mythicSkill();
            // optional whitespace
            this.consumeWhitespace();
            // weight
            let weight: MythicToken | undefined;
            if (this.match("Number")) {
                weight = this.previous();
            }
            this.consumeWhitespace();
            const commaSeparatedSkill: CommaSeparatedSkill = {
                skill,
                weight,
            };
            // required comma, except at the end
            if (!this.isAtEnd()) {
                const comma = this.consume("Comma", "Expected ',' after skill!");
                commaSeparatedSkill.comma = comma;
            }
            // optional whitespace
            this.consumeWhitespace();
            skills.push(commaSeparatedSkill);
        }
        return new CommaSeparatedSkills(this, this.currentPosition(), skills);
    }
}

export class MFCommaSeparatedSkills extends MythicFieldType {
    constructor() {
        super();
        this.setName("commaSeparatedSkills");
    }
    override validate(doc: DocumentInfo, value: MlcValueExpr, _: Resolver): Expr[] {
        const str = value.getSource();
        const scanner = new MythicScanner(doc, value.range.start.toOffset(doc.lineLengths), str);
        const tokens = scanner.scanTokens();
        let expr: CommaSeparatedSkills;
        try {
            expr = new MFCommaSeparatedSkillsParser(tokens).commaSeparatedSkills();
        } catch (e) {
            if (e instanceof GenericError) {
                doc.addError(e);
            }
            return [];
        }
        const skills = expr.skills;
        const arr: Expr[] = [];
        for (const { skill, weight } of skills) {
            if (weight) {
                doc.addHighlight(new Highlight(weight.range, SemanticTokenTypes.number));
            }
            if (skill instanceof InlineSkillExpr) {
                MFMythicSkill.validateInlineSkill(doc, value, skill);
                arr.push(skill);
                continue;
            }
            MFMythicSkill.validateSkillName(doc, value, skill);
        }
        return arr;
    }
}
