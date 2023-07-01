import { Position, Range } from "vscode-languageserver-textdocument";
import { MythicToken } from "./scanner.js";
import { Parser } from "./parser.js";
import { CustomPosition, CustomRange, r } from "../utils/positionsAndRanges.js";
import { compare } from "tick-ts-utils";

export abstract class Expr {
    constructor(readonly parser: Parser, readonly start: Position) {}

    range: CustomRange = r(0, 0, 0, 0);

    abstract printAST(): string;

    abstract toJson(): object;

    abstract formatSource(): string;

    getSource(): string {
        return this.range.getFrom(this.parser.result.source);
    }

    abstract accept<T>(visitor: ExprVisitor<T>): T;
}

export abstract class ExprVisitor<T> {
    abstract visitSkillLineExpr(skillLine: SkillLineExpr): T;

    abstract visitMechanicExpr(mechanic: MechanicExpr): T;

    abstract visitTargeterExpr(targeter: TargeterExpr): T;

    abstract visitTriggerExpr(trigger: TriggerExpr): T;

    abstract visitInlineConditionExpr(condition: InlineConditionExpr): T;

    abstract visitMlcExpr(mlc: MlcExpr): T;

    abstract visitMlcValueExpr(mlcValue: MlcValueExpr): T;

    abstract visitMlcPlaceholderExpr(mlcPlaceholder: MlcPlaceholderExpr): T;

    abstract visitInlineSkillExpr(inlineSkill: InlineSkillExpr): T;

    abstract visitHealthModifierExpr(healthModifier: HealthModifierExpr): T;

    abstract visitGenericStringExpr(genericString: GenericStringExpr): T;
}

export abstract class ExprWithMlcs extends Expr {
    readonly mlcs: MlcExpr[] | undefined = [];

    mlcsToMap(): Map<string, MlcValueExpr | InlineSkillExpr> {
        const map = new Map<string, MlcValueExpr | InlineSkillExpr>();
        if (this.mlcs === undefined) {
            return map;
        }
        for (const mlc of this.mlcs) {
            map.set(mlc.identifier.lexeme ?? "", mlc.value);
        }
        return map;
    }

    mlcsToTokenMap(): Map<MythicToken, MlcValueExpr | InlineSkillExpr> {
        const map = new Map<MythicToken, MlcValueExpr | InlineSkillExpr>();
        if (this.mlcs === undefined) {
            return map;
        }
        for (const mlc of this.mlcs) {
            map.set(mlc.identifier, mlc.value);
        }
        return map;
    }
}

export class SkillLineExpr extends Expr {
    constructor(
        readonly parser: Parser,
        readonly start: Position,
        readonly mechanic: MechanicExpr,
        readonly targeter: TargeterExpr | undefined,
        readonly trigger: TriggerExpr | undefined,
        readonly conditions: InlineConditionExpr[] | undefined,
        readonly chance: MythicToken | undefined,
        readonly healthModifier: HealthModifierExpr | undefined,
    ) {
        super(parser, start);
        const rStart = this.mechanic.range.start;
        let rEnd = this.mechanic.range.end;
        for (const expr of [this.mechanic, this.targeter, this.trigger, this.conditions, this.healthModifier].flat()) {
            if (expr !== undefined && compare(expr.range.end, rEnd) === 1) {
                rEnd = expr.range.end;
            }
        }
        this.range = r(rStart, rEnd);
    }

    override printAST(): string {
        return `(SkillLine Mechanic: ${this.mechanic.printAST()}, Targeter: ${this.targeter?.printAST()}, Trigger: ${this.trigger?.printAST()}, Conditions: ${this.conditions
            ?.map((c) => c.printAST())
            .join(" ")}) Chance: ${this.chance?.lexeme} HealthModifier: ${this.healthModifier?.printAST()}`;
    }

    toJson() {
        return {
            mechanic: this.mechanic.toJson(),
            targeter: this.targeter?.toJson(),
            trigger: this.trigger?.toJson(),
            conditions: this.conditions?.map((c) => c.toJson()),
        };
    }

    toSimpleJson(): object {
        return {
            mechanic: this.mechanic.formatSource(),
            targeter: this.targeter?.formatSource(),
            trigger: this.trigger?.formatSource(),
            conditions: this.conditions?.map((c) => c.formatSource()),
        };
    }

    override formatSource(): string {
        let string = "";
        if (this.mechanic !== undefined) {
            string += this.mechanic.formatSource();
        }
        if (this.targeter !== undefined) {
            string += ` ${this.targeter.formatSource()}`;
        }
        if (this.trigger !== undefined) {
            string += ` ${this.trigger.formatSource()}`;
        }
        if (this.conditions !== undefined && this.conditions.length > 0) {
            string += ` ${this.conditions.map((c) => c.formatSource()).join(" ")}`;
        }
        if (this.chance !== undefined) {
            string += ` ${this.chance.lexeme}`;
        }
        if (this.healthModifier !== undefined) {
            string += ` ${this.healthModifier.formatSource()}`;
        }
        return string;
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitSkillLineExpr(this);
    }
}

export class MechanicExpr extends ExprWithMlcs {
    constructor(
        readonly parser: Parser,
        readonly start: Position,
        readonly identifier: GenericStringExpr,
        readonly leftBrace: MythicToken | undefined,
        readonly mlcs: MlcExpr[] | undefined,
        readonly rightBrace: MythicToken | undefined,
    ) {
        super(parser, start);
        const rStart = this.identifier.range.start;
        const rEnd = this.rightBrace?.range.end ?? this.identifier.range.end;
        this.range = r(rStart, rEnd);
    }

    override printAST(): string {
        return `(M ${this.identifier.formatSource()} ${this.mlcs?.map((mlc) => mlc.printAST()) ?? ""})`;
    }

    override toJson(): object {
        return {
            identifier: this.identifier.formatSource(),
            mlcs: this.mlcs?.map((mlc) => mlc.toJson()),
        };
    }

    override formatSource() {
        return `${this.identifier.value()}{${this.mlcs?.map((mlc) => mlc.formatSource()).join(";")}}`;
    }

    getNameRange() {
        return this.identifier.range;
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitMechanicExpr(this);
    }
}

export class TargeterExpr extends ExprWithMlcs {
    constructor(
        readonly parser: Parser,
        readonly start: Position,
        readonly at: MythicToken,
        readonly identifier: MythicToken,
        readonly leftBrace: MythicToken | undefined,
        readonly mlcs: MlcExpr[] | undefined,
        readonly rightBrace: MythicToken | undefined,
    ) {
        super(parser, start);
        const rStart = this.identifier.range.start;
        const rEnd = this.rightBrace?.range.end ?? this.identifier.range.end;
        this.range = r(rStart, rEnd);
    }

    override printAST(): string {
        return `(@ ${this.identifier.lexeme} ${this.mlcs?.map((mlc) => mlc.printAST()) ?? ""})`;
    }

    override toJson(): object {
        return {
            identifier: this.identifier.lexeme,
            mlcs: this.mlcs?.map((mlc) => mlc.toJson()),
        };
    }

    override formatSource() {
        return `@${this.identifier.lexeme}{${this.mlcs?.map((mlc) => mlc.formatSource()).join(";")}}`;
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitTargeterExpr(this);
    }
}

export class TriggerExpr extends ExprWithMlcs {
    constructor(
        readonly parser: Parser,
        readonly start: Position,
        readonly caret: MythicToken,
        readonly identifier: GenericStringExpr,
        readonly colon: MythicToken | undefined,
        readonly arg: GenericStringExpr | undefined,
    ) {
        super(parser, start);
        this.range = r(this.caret.range.start, this.arg?.range.end ?? this.identifier.range.end);
    }

    override printAST(): string {
        return `(~ ${this.identifier.value()} ${this.arg?.value() ?? ""})`;
    }

    override toJson(): object {
        return {
            identifier: this.identifier.value(),
            arg: this.arg?.value(),
        };
    }

    override formatSource() {
        return `~${this.identifier.value()}${this.arg !== undefined ? `:${this.arg.value()}` : ""}`;
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitTriggerExpr(this);
    }
}

export class InlineConditionExpr extends ExprWithMlcs {
    constructor(
        readonly parser: Parser,
        readonly start: Position,
        readonly question: MythicToken,
        readonly identifier: MythicToken,
        readonly leftBrace: MythicToken | undefined,
        readonly mlcs: MlcExpr[] | undefined,
        readonly rightBrace: MythicToken | undefined,
        /**
         * If the condition is negated. Represented by a "!" in the Mythic language.
         */
        readonly negate: boolean,
        /**
         * If the condition is a TriggerCondition. Represented by a "~" in the Mythic language.
         */
        readonly trigger: boolean,
    ) {
        super(parser, start);
        const rStart = this.question.range.start;
        const rEnd = this.rightBrace?.range.end ?? this.identifier.range.end;
        this.range = r(rStart, rEnd);
    }

    override printAST(): string {
        return `(? ${this.identifier.lexeme} ${this.mlcs?.map((mlc) => mlc.printAST()) ?? ""} ${this.negate ? "Negated" : ""} ${
            this.trigger ? "Only" : ""
        })`;
    }

    override toJson(): object {
        return {
            identifier: this.identifier.lexeme,
            mlcs: this.mlcs?.map((mlc) => mlc.toJson()),
            negate: this.negate,
            trigger: this.trigger,
        };
    }

    override formatSource() {
        return `?${this.trigger ? "~" : ""}${this.negate ? "!" : ""}${this.identifier.lexeme}{${this.mlcs
            ?.map((mlc) => mlc.formatSource())
            .join(";")}}`;
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitInlineConditionExpr(this);
    }
}

export class MlcExpr extends Expr {
    constructor(
        readonly parser: Parser,
        readonly start: Position,
        readonly identifier: MythicToken,
        readonly equals: MythicToken,
        readonly value: MlcValueExpr | InlineSkillExpr,
        readonly semicolon: MythicToken | undefined,
    ) {
        super(parser, start);
        this.range = r(this.identifier.range.start, this.semicolon?.range.end ?? this.value.range.end);
    }

    override printAST(): string {
        return `(Mlc ${this.identifier.lexeme} ${this.value.printAST()})`;
    }

    override toJson(): object {
        return {
            identifier: this.identifier.lexeme,
            mlcValue: this.value.formatSource(),
        };
    }

    override formatSource() {
        return `${this.identifier.lexeme}=${this.value.formatSource()}`;
    }

    getKeyRange() {
        return this.identifier.range;
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitMlcExpr(this);
    }
}

export class MlcValueExpr extends Expr {
    constructor(readonly parser: Parser, readonly start: CustomPosition, readonly identifiers: (MythicToken[] | MlcPlaceholderExpr)[]) {
        super(parser, start);
        this.range = r(this.start, this.#getEnd());
    }

    override printAST(): string {
        return `(MlcValue ${this.identifiers
            .map((id) => (id instanceof MlcPlaceholderExpr ? id.printAST() : id.map((j) => j.lexeme).join("")))
            .join(", ")})`;
    }

    override toJson(): object {
        return {
            identifier: this.identifiers,
        };
    }

    override formatSource() {
        return this.identifiers.map((id) => (id instanceof MlcPlaceholderExpr ? id.formatSource() : id.map((j) => j.lexeme).join(""))).join("");
    }

    #getEnd(): CustomPosition {
        if (this.identifiers.length === 0) {
            return this.start;
        }
        const last = this.identifiers[this.identifiers.length - 1];
        if (last instanceof MlcPlaceholderExpr) {
            return last.greaterThanBracket.range.end;
        }
        if (last.length > 0) {
            return last[last.length - 1].range.end;
        }
        return this.start;
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitMlcValueExpr(this);
    }
}

export class MlcPlaceholderExpr extends Expr {
    constructor(
        readonly parser: Parser,
        readonly start: Position,
        readonly lessThanBracket: MythicToken,
        readonly identifiers: [GenericStringExpr, MythicToken?, MlcExpr[]?, MythicToken?][],
        readonly dots: MythicToken[],
        readonly greaterThanBracket: MythicToken,
    ) {
        super(parser, start);
        this.range = r(this.lessThanBracket.range.start, this.greaterThanBracket.range.end);
    }

    override printAST(): string {
        return `(<${this.identifiers.map((i) => i[0].value() + (i[2]?.map((mlc) => mlc.printAST()).join(";") ?? "")).join(", ")}>)`;
    }

    override toJson(): object {
        return {
            identifier: this.identifiers,
        };
    }

    override formatSource(): string {
        return `<${this.identifiers.map((i) => i[0].value() + (i[2]?.map((mlc) => mlc.formatSource()).join(";") ?? "")).join(".")}>`;
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitMlcPlaceholderExpr(this);
    }
}

export class InlineSkillExpr extends Expr {
    constructor(
        readonly parser: Parser,
        readonly start: Position,
        readonly leftSquareBracket: MythicToken,
        readonly skills: [MythicToken, SkillLineExpr][],
        readonly rightSquareBracket: MythicToken,
    ) {
        super(parser, start);
        this.range = r(this.leftSquareBracket.range.start, this.rightSquareBracket.range.end);
    }

    override printAST(): string {
        return `(InlineSkill ${this.skills.map((skill) => skill[1].printAST())})`;
    }

    override toJson(): object {
        return {
            skills: this.skills.map((skill) => skill[1].toJson()),
        };
    }

    override formatSource() {
        return `[${this.skills.map((skill) => `- ${skill[1].formatSource()}`).join(" ")}]`;
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitInlineSkillExpr(this);
    }
}

export class HealthModifierExpr extends Expr {
    constructor(
        readonly parser: Parser,
        readonly start: Position,
        readonly operator: MythicToken,
        /**
         * Either a single value or a range of values.
         * Each value is a tuple of the value token, and an optional percent token.
         */
        readonly valueOrRange: [MythicToken, MythicToken?] | [[MythicToken, MythicToken?], [MythicToken, MythicToken?]],
    ) {
        super(parser, start);
        if (this.isRange(this.valueOrRange)) {
            this.range = r(this.operator.range.start, this.valueOrRange[1][0].range.end);
        } else {
            this.range = r(this.operator.range.start, this.valueOrRange[0].range.end);
        }
    }

    override formatSource(): string {
        if (this.isRange(this.valueOrRange)) {
            return `${this.operator.lexeme}${this.valueOrRange[0][0].lexeme}${this.valueOrRange[0][1]?.lexeme ?? ""}-${
                this.valueOrRange[1][0].lexeme
            }${this.valueOrRange[1][1]?.lexeme ?? ""}`;
        } else {
            return `${this.operator.lexeme}${this.valueOrRange[0].lexeme}${this.valueOrRange[1]?.lexeme}`;
        }
    }

    override printAST(): string {
        return `(HealthModifier ${this.formatSource()})`;
    }

    override toJson(): object {
        return {
            operator: this.operator.lexeme,
            valueOrRange: this.isRange(this.valueOrRange)
                ? [this.valueOrRange[0].map((value) => value?.lexeme ?? ""), this.valueOrRange[1].map((value) => value?.lexeme ?? "")]
                : this.valueOrRange.map((value) => value?.lexeme ?? ""),
        };
    }

    isRange(
        valueOrRange: [MythicToken, MythicToken?] | [[MythicToken, MythicToken?], [MythicToken, MythicToken?]],
    ): valueOrRange is [[MythicToken, MythicToken?], [MythicToken, MythicToken?]] {
        return Array.isArray(valueOrRange[0]);
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitHealthModifierExpr(this);
    }
}

export class GenericStringExpr extends Expr {
    constructor(readonly parser: Parser, readonly start: Position, readonly values: MythicToken[]) {
        super(parser, start);
        const last = this.values[this.values.length - 1];
        this.range = r(this.values[0].range.start, last.range.end);
    }

    override printAST(): string {
        return `(GenericString ${this.values.map((value) => value.lexeme).join("")})`;
    }

    override toJson(): object {
        return {
            values: this.values.map((value) => value.lexeme),
        };
    }

    override formatSource() {
        return this.values.map((value) => value.lexeme).join("");
    }

    value() {
        return this.values.map((value) => value.lexeme).join("");
    }

    override accept<T>(visitor: ExprVisitor<T>): T {
        return visitor.visitGenericStringExpr(this);
    }
}
