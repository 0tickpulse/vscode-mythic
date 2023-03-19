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
    #characters: Map<CustomRange, Color> = new Map();
    constructor(public ast: Expr) {
        super();
        this.#characters.clear();
        ast.accept(this);
    }
    #addHighlight(range: CustomRange, color: Color) {
        this.#characters.set(range, color);
    }
    #addHighlightGenericString(genericString: GenericStringExpr, color: Color) {
        this.#addHighlight(genericString.getRange(), color);
    }
    highlight(doc: DocumentInfo, initialOffset: CustomRange) {
        this.#characters.forEach((color, range) => {
            doc.addHighlights(new Highlight(range.add(initialOffset.start), color.toCss()));
        });
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
            this.#addHighlight(chance.getRange(), COLORS.chance);
        }
    }
    visitMechanicExpr(mechanic: MechanicExpr): void {
        const name = mechanic.identifier.value();
        this.#addHighlight(mechanic.getNameRange(), COLORS.mechanicName);
        if (mechanic.leftBrace) {
            this.#addHighlight(mechanic.leftBrace.getRange(), COLORS.brace);
        }
        for (const mlc of mechanic.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (mechanic.rightBrace) {
            this.#addHighlight(mechanic.rightBrace.getRange(), COLORS.brace);
        }
    }
    visitTargeterExpr(targeter: TargeterExpr): void {
        const at = targeter.at;
        this.#addHighlight(at.getRange(), COLORS.targeterAt);
        const name = targeter.identifier.lexeme!;
        this.#addHighlight(targeter.identifier.getRange(), COLORS.targeterName);
        if (targeter.leftBrace) {
            this.#addHighlight(targeter.leftBrace.getRange(), COLORS.brace);
        }
        for (const mlc of targeter.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (targeter.rightBrace) {
            this.#addHighlight(targeter.rightBrace.getRange(), COLORS.brace);
        }
    }
    visitTriggerExpr(trigger: TriggerExpr): void {
        const caret = trigger.caret;
        this.#addHighlight(caret.getRange(), COLORS.triggerCaret);
        const name = trigger.identifier.value();
        this.#addHighlight(trigger.identifier.getRange(), COLORS.triggerName);
        if (trigger.colon) {
            this.#addHighlight(trigger.colon.getRange(), COLORS.brace);
        }
        if (trigger.arg) {
            this.#addHighlightGenericString(trigger.arg, COLORS.triggerArg);
        }
    }
    visitInlineConditionExpr(condition: InlineConditionExpr): void {
        const question = condition.question;
        this.#addHighlight(question.getRange(), COLORS.inlineConditionQuestion);
        const name = condition.identifier.lexeme!;
        this.#addHighlight(condition.identifier.getRange(), COLORS.inlineConditionName);
        if (condition.leftBrace) {
            this.#addHighlight(condition.leftBrace.getRange(), COLORS.brace);
        }
        for (const mlc of condition.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (condition.rightBrace) {
            this.#addHighlight(condition.rightBrace.getRange(), COLORS.brace);
        }
    }
    visitMlcExpr(mlc: MlcExpr): void {
        const { identifier, equals, semicolon } = mlc;
        this.#addHighlight(identifier.getRange(), COLORS.yamlKey);
        this.#addHighlight(equals.getRange(), COLORS.colonAndEquals);
        if (semicolon !== undefined) {
            this.#addHighlight(semicolon.getRange(), COLORS.mythicLineConfigSemicolon);
        }
        mlc.value.accept(this);
    }
    visitMlcValueExpr(yamlValue: MlcValueExpr): void {
        const { identifiers } = yamlValue;
        for (const identifier of identifiers) {
            if (Array.isArray(identifier)) {
                for (const token of identifier) {
                    this.#addHighlight(token.getRange(), COLORS.yamlValue);
                }
            } else {
                identifier.accept(this);
            }
        }
    }
    visitMlcPlaceholderExpr(mlcPlaceholder: MlcPlaceholderExpr): void {
        const { greaterThanBracket, lessThanBracket } = mlcPlaceholder;
        this.#addHighlight(greaterThanBracket.getRange(), COLORS.placeholder);
        this.#addHighlight(lessThanBracket.getRange(), COLORS.placeholder);

        for (const identifier of mlcPlaceholder.identifiers) {
            this.#addHighlightGenericString(identifier[0], COLORS.placeholder);
            if (identifier[1] !== undefined) {
                this.#addHighlight(identifier[1].getRange(), COLORS.brace);
            }
            for (const mlcExpr of identifier[2] ?? []) {
                this.visitMlcExpr(mlcExpr);
            }
            if (identifier[3] !== undefined) {
                this.#addHighlight(identifier[3].getRange(), COLORS.brace);
            }
        }
        for (const dot of mlcPlaceholder.dots) {
            this.#addHighlight(dot.getRange(), COLORS.placeholderDot);
        }
    }
    visitInlineSkillExpr(inlineSkill: InlineSkillExpr): void {
        const { leftSquareBracket, rightSquareBracket } = inlineSkill;
        this.#addHighlight(leftSquareBracket.getRange(), COLORS.inlineSkillBracket);
        this.#addHighlight(rightSquareBracket.getRange(), COLORS.inlineSkillBracket);
        for (const skill of inlineSkill.skills) {
            const dash = skill[0];
            const skillExpr = skill[1];
            this.#addHighlight(dash.getRange(), COLORS.inlineSkillDash);
            skillExpr.accept(this);
        }
    }
    visitHealthModifierExpr(healthModifier: HealthModifierExpr): void {
        const { operator, valueOrRange } = healthModifier;
        this.#addHighlight(operator.getRange(), COLORS.healthModifier);
        if (healthModifier.isRange(valueOrRange)) {
            const from = valueOrRange[0];
            const to = valueOrRange[1];
            for (const token of [from, to].flat()) {
                if (token === undefined) {
                    continue;
                }
                this.#addHighlight(token.getRange(), COLORS.healthModifier);
            }
        } else {
            for (const token of valueOrRange) {
                if (token === undefined) {
                    continue;
                }
                this.#addHighlight(token.getRange(), COLORS.healthModifier);
            }
        }
    }
    visitGenericStringExpr(genericString: GenericStringExpr): void {}
}
