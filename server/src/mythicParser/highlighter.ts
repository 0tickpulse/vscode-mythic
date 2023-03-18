import {
    ExprVisitor,
    GenericStringExpr,
    Expr,
    SkillLineExpr,
    MechanicExpr,
    TargeterExpr,
    TriggerExpr,
    InlineConditionExpr,
    MlcExpr,
    MlcValueExpr,
    MlcPlaceholderExpr,
    InlineSkillExpr,
    HealthModifierExpr,
} from "./parserExpressions.js";
import { COLORS, Color, Highlight, addColorAnsi } from "../colors.js";
import { DocumentInfo } from "../yaml/parser/parser.js";
import { CustomPosition, CustomRange, p, r } from "../utils/positionsAndRanges.js";

export class Highlighter extends ExprVisitor<void> {
    #characters: Map<CustomPosition, { character: string; color: Color }> = new Map();
    constructor(public ast: Expr) {
        super();
        this.#characters.clear();
        ast.accept(this);
    }
    #setCharacters(start: CustomPosition, str: string, color: Color) {
        for (let i = 0; i < str.length; i++) {
            this.#characters.set(start.addOffset(this.ast.getSource(), i), {
                character: str[i],
                color,
            });
        }
    }
    #setCharactersGenericString(genericString: GenericStringExpr, color: Color) {
        const value = genericString.value();
        this.#setCharacters(genericString.getRange().start, value, color);
    }
    compileAnsi(): string {
        const lines: { character: string; color: Color }[][] = [];
        for (const [position, { character, color }] of this.#characters) {
            if (!lines[position.line]) {
                lines[position.line] = [];
            }
            const char = position.character;
            if (lines[position.line].length > char) {
                // override
                lines[position.line][char] = { character, color };
            }
            // if line is longer than the current character, fill in the blanks
            while (lines[position.line].length < char) {
                lines[position.line].push({ character: " ", color: new Color(0, 0, 0) });
            }
            lines[position.line][char] = { character, color };
        }
        return lines.map((line) => line.map(({ character, color }) => addColorAnsi(color, character)).join("")).join("\n");
    }
    generateCharacterTable() {
        const lines: { position: CustomPosition; color: Color; character: string }[][] = [];
        for (const [position, { color, character }] of this.#characters) {
            if (!lines[position.line]) {
                lines[position.line] = [];
            }
            lines[position.line].push({ position, color, character });
        }
        return lines;
    }

    highlight(doc: DocumentInfo, initialOffset: CustomRange) {
        for (const [position, { color }] of this.#characters) {
            const range = r(position, position.addOffset(this.ast.getSource(), 1)).add(initialOffset.start);
            const highlight: Highlight = new Highlight(range, color);
            doc.addHighlights(highlight);
        }
    }

    visitSkillLineExpr(skillLine: SkillLineExpr): void {
        this.visitMechanicExpr(skillLine.mechanic);
        if (skillLine.targeter) {
            this.visitTargeterExpr(skillLine.targeter);
        }
        if (skillLine.trigger) {
            this.visitTriggerExpr(skillLine.trigger);
        }

        for (const condition of skillLine.conditions ?? []) {
            this.visitInlineConditionExpr(condition);
        }

        if (skillLine.healthModifier) {
            this.visitHealthModifierExpr(skillLine.healthModifier);
        }
        if (skillLine.chance) {
            const { chance } = skillLine;
            this.#setCharacters(chance.getRange().start, chance.lexeme!, COLORS.chance);
        }
    }
    visitMechanicExpr(mechanic: MechanicExpr): void {
        const name = mechanic.identifier.value();
        this.#setCharacters(mechanic.getNameRange().start, name, COLORS.mechanicName);
        if (mechanic.leftBrace) {
            this.#setCharacters(mechanic.leftBrace.getRange().start, mechanic.leftBrace.lexeme!, COLORS.brace);
        }
        for (const mlc of mechanic.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (mechanic.rightBrace) {
            this.#setCharacters(mechanic.rightBrace.getRange().start, mechanic.rightBrace.lexeme!, COLORS.brace);
        }
    }
    visitTargeterExpr(targeter: TargeterExpr): void {
        const at = targeter.at;
        this.#setCharacters(at.getRange().start, at.lexeme!, COLORS.targeterAt);
        const name = targeter.identifier.lexeme!;
        this.#setCharacters(targeter.identifier.getRange().start, name, COLORS.targeterName);
        if (targeter.leftBrace) {
            this.#setCharacters(targeter.leftBrace.getRange().start, targeter.leftBrace.lexeme!, COLORS.brace);
        }
        for (const mlc of targeter.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (targeter.rightBrace) {
            this.#setCharacters(targeter.rightBrace.getRange().start, targeter.rightBrace.lexeme!, COLORS.brace);
        }
    }
    visitTriggerExpr(trigger: TriggerExpr): void {
        const caret = trigger.caret;
        this.#setCharacters(caret.getRange().start, caret.lexeme!, COLORS.triggerCaret);
        const name = trigger.identifier.value();
        this.#setCharacters(trigger.identifier.getRange().start, name, COLORS.triggerName);
        if (trigger.colon) {
            this.#setCharacters(trigger.colon.getRange().start, trigger.colon.lexeme!, COLORS.brace);
        }
        if (trigger.arg) {
            this.#setCharactersGenericString(trigger.arg, COLORS.triggerArg);
        }
    }
    visitInlineConditionExpr(condition: InlineConditionExpr): void {
        const question = condition.question;
        this.#setCharacters(question.getRange().start, question.lexeme!, COLORS.inlineConditionQuestion);
        const name = condition.identifier.lexeme!;
        this.#setCharacters(condition.identifier.getRange().start, name, COLORS.inlineConditionName);
        if (condition.leftBrace) {
            this.#setCharacters(condition.leftBrace.getRange().start, condition.leftBrace.lexeme!, COLORS.brace);
        }
        for (const mlc of condition.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (condition.rightBrace) {
            this.#setCharacters(condition.rightBrace.getRange().start, condition.rightBrace.lexeme!, COLORS.brace);
        }
    }
    visitMlcExpr(mlc: MlcExpr): void {
        const { identifier, equals, semicolon } = mlc;
        this.#setCharacters(identifier.getRange().start, identifier.lexeme!, COLORS.yamlKey);
        this.#setCharacters(equals.getRange().start, equals.lexeme!, COLORS.colonAndEquals);
        if (semicolon !== undefined) {
            this.#setCharacters(semicolon.getRange().start, semicolon.lexeme!, COLORS.mythicLineConfigSemicolon);
        }
        mlc.value.accept(this);
    }
    visitMlcValueExpr(yamlValue: MlcValueExpr): void {
        const { identifiers } = yamlValue;
        for (const identifier of identifiers) {
            if (Array.isArray(identifier)) {
                for (const token of identifier) {
                    this.#setCharacters(token.getRange().start, token.lexeme!, COLORS.yamlValue);
                }
            } else {
                identifier.accept(this);
            }
        }
    }
    visitMlcPlaceholderExpr(mlcPlaceholder: MlcPlaceholderExpr): void {
        const { greaterThanBracket, lessThanBracket } = mlcPlaceholder;
        this.#setCharacters(greaterThanBracket.getRange().start, greaterThanBracket.lexeme!, COLORS.placeholder);
        this.#setCharacters(lessThanBracket.getRange().start, lessThanBracket.lexeme!, COLORS.placeholder);

        for (const identifier of mlcPlaceholder.identifiers) {
            this.#setCharactersGenericString(identifier[0], COLORS.placeholder);
            if (identifier[1] !== undefined) {
                this.#setCharacters(identifier[1].getRange().start, identifier[1].lexeme!, COLORS.brace);
            }
            for (const mlcExpr of identifier[2] ?? []) {
                this.visitMlcExpr(mlcExpr);
            }
            if (identifier[3] !== undefined) {
                this.#setCharacters(identifier[3].getRange().start, identifier[3].lexeme!, COLORS.brace);
            }
        }
        for (const dot of mlcPlaceholder.dots) {
            this.#setCharacters(dot.getRange().start, dot.lexeme!, COLORS.placeholderDot);
        }
    }
    visitInlineSkillExpr(inlineSkill: InlineSkillExpr): void {
        const { leftSquareBracket, rightSquareBracket } = inlineSkill;
        this.#setCharacters(leftSquareBracket.getRange().start, leftSquareBracket.lexeme!, COLORS.inlineSkillBracket);
        this.#setCharacters(rightSquareBracket.getRange().start, rightSquareBracket.lexeme!, COLORS.inlineSkillBracket);
        for (const skill of inlineSkill.skills) {
            const dash = skill[0];
            const skillExpr = skill[1];
            this.#setCharacters(dash.getRange().start, dash.lexeme!, COLORS.inlineSkillDash);
            skillExpr.accept(this);
        }
    }
    visitHealthModifierExpr(healthModifier: HealthModifierExpr): void {
        const { operator, valueOrRange } = healthModifier;
        this.#setCharacters(operator.getRange().start, operator.lexeme!, COLORS.healthModifier);
        if (healthModifier.isRange(valueOrRange)) {
            const from = valueOrRange[0];
            const to = valueOrRange[1];
            for (const token of [from, to].flat()) {
                if (token === undefined) {
                    continue;
                }
                this.#setCharacters(token.getRange().start, token.lexeme!, COLORS.healthModifier);
            }
        } else {
            for (const token of valueOrRange) {
                if (token === undefined) {
                    continue;
                }
                this.#setCharacters(token.getRange().start, token.lexeme!, COLORS.healthModifier);
            }
        }
    }
    visitGenericStringExpr(genericString: GenericStringExpr): void {}
}
