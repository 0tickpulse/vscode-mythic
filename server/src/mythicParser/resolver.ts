import { Color, Optional, stripIndentation } from "tick-ts-utils";
import { DiagnosticSeverity, SemanticTokenTypes } from "vscode-languageserver";
import { ColorHint, Highlight, SemanticTokenModifier } from "../colors.js";
import { ResolverError } from "../errors.js";
import { VARIABLE_SCOPES } from "../mythicData/data.js";
import {
    generateHover,
    generateHoverForField,
    getAllMechanicsAndAliases,
    getClosestMatch,
    getHolderFieldFromName,
    getHolderFromName,
} from "../mythicData/services.js";
import { MythicHolder } from "../mythicData/types.js";
import { CustomRange } from "../utils/positionsAndRanges.js";
import { todo } from "../utils/utils.js";
import { Dependency, DocumentInfo, RangeLink } from "../yaml/parser/documentInfo.js";
import {
    Expr,
    ExprVisitor,
    ExprWithMlcs,
    GenericStringExpr,
    HealthModifierExpr,
    InlineConditionExpr,
    InlineSkillExpr,
    MechanicExpr,
    MlcExpr,
    MlcPlaceholderExpr,
    MlcValueExpr,
    SkillLineExpr,
    TargeterExpr,
    TriggerExpr,
} from "./parserExpressions.js";
import { MythicToken } from "./scanner.js";
import { CachedMythicSkill } from "../mythicModels.js";
import { dbg } from "../utils/logging.js";

export class Resolver extends ExprVisitor<void> {
    #source = "";
    #expr: Optional<Expr> = Optional.empty();
    #currentSkill?: SkillLineExpr;
    #skillVariables: Map<string, MlcValueExpr> = new Map();
    constructor(public doc: DocumentInfo, public cachedSkill?: CachedMythicSkill) {
        super();
    }
    setAst(expr: Expr) {
        this.#expr = Optional.of(expr);
        this.#source = expr.parser.result.source;
        return this;
    }
    #addHighlight(range: CustomRange, color: SemanticTokenTypes, modifiers: SemanticTokenModifier[] = []) {
        this.doc.addHighlight(new Highlight(range, color, modifiers));
        return [color, modifiers] as const;
    }
    #addHighlightGenericString(genericString: GenericStringExpr, color: SemanticTokenTypes) {
        this.#addHighlight(genericString.range, color);
    }
    resolve() {
        this.#resolveExpr();
    }
    #resolveExpr(expr: Expr | null | undefined = this.#expr.get()): void {
        if (!expr) {
            return;
        }
        // benchmark
        // console.time(`resolve ${expr.constructor.name}`);
        const value = expr.accept(this);
        // console.timeEnd(`resolve ${expr.constructor.name}`);
        return value;
    }
    toString() {
        return `Resolver(${this.doc.uri}, ${this.cachedSkill?.name})`;
    }
    override visitSkillLineExpr(skillLine: SkillLineExpr): void {
        this.#currentSkill = skillLine;
        this.#resolveExpr(skillLine.mechanic ?? null);
        this.#resolveExpr(skillLine.targeter ?? null);
        this.#resolveExpr(skillLine.trigger ?? null);
        this.#resolveExpr(skillLine.healthModifier ?? null);
        for (const condition of skillLine.conditions ?? []) {
            this.#resolveExpr(condition);
        }
        this.#currentSkill = undefined;
        if (skillLine.chance) {
            const { chance } = skillLine;
            this.#addHighlight(chance.range, SemanticTokenTypes.number);
        }
    }
    override visitMechanicExpr(mechanic: MechanicExpr): void {
        const mechanicName = mechanic.identifier.value();
        const nameHighlight = this.#addHighlight(mechanic.getNameRange(), SemanticTokenTypes.function);
        if (mechanic.leftBrace) {
            this.#addHighlight(mechanic.leftBrace.range, SemanticTokenTypes.operator);
        }
        for (const mlc of mechanic.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        mechanic.rightBrace !== undefined && this.#addHighlight(mechanic.rightBrace.range, SemanticTokenTypes.operator);

        if (!getAllMechanicsAndAliases().includes(mechanicName.toLowerCase())) {
            this.doc.addError(new UnknownMechanicResolverError(this.#source, mechanic, this.#currentSkill).toDiagnostic());
            return;
        }

        /** Whether to keep resolving */
        let keepResolving = true;
        const mechanicData: Optional<MythicHolder> = getHolderFromName("mechanic", mechanicName);
        mechanicData
            .ifPresent((data) => {
                this.doc.addHover({
                    ...generateHover("mechanic", mechanicName, data),
                    range: mechanic.getNameRange(),
                });
                if (data.definition) {
                    this.doc.addGotoDefinitionAndReverseReference(new RangeLink(mechanic.getNameRange(), data.definition.range, data.definition.doc));
                    this.cachedSkill?.dependencies.push(data.definition);
                    nameHighlight[1].push("mutable");
                } else {
                    nameHighlight[1].push("defaultLibrary");
                }
            })
            .map((d) => d.fields)
            .ifPresent((fields) => {
                const fieldsAndAliases = fields.flatMap((field) => field.names);
                for (const [key, arg] of mechanic.mlcsToTokenMap()) {
                    if (!fieldsAndAliases.includes(key.lexeme ?? "")) {
                        this.#addError(
                            stripIndentation`Unknown field '${key.lexeme ?? ""}' for mechanic '${mechanicName}'
                        Possible fields: ${fieldsAndAliases.map((a) => `\`${a}\``).join(", ")}`,
                            arg,
                            key.range,
                        );
                        continue;
                    }
                    this.#resolveExpr(arg);
                    const matchedField = fields.find((field) => field.names.includes(key.lexeme ?? ""))!;
                    // field is valid, add hover
                    this.doc.addHover({
                        contents: generateHoverForField(mechanicName, "mechanic", key.lexeme!, matchedField, true),
                        range: key.range,
                    });
                }
                for (const [name, { required }] of Object.entries(fields)) {
                    if (required && !fieldsAndAliases.some((value) => mechanic.mlcsToMap().has(value))) {
                        this.#addError(`Missing required field '${name}' for mechanic '${mechanicName}'`, mechanic, mechanic.getNameRange());
                        keepResolving = false;
                    }
                }
                if (!keepResolving) {
                    return;
                }

                for (const [key, arg] of mechanic.mlcsToMap()) {
                    if (arg instanceof InlineSkillExpr) {
                        continue;
                    }
                    if (arg.identifiers.some((value) => value instanceof MlcPlaceholderExpr)) {
                        continue;
                    }
                    const field = getHolderFieldFromName(mechanicData.get(), key).otherwise(undefined);
                    if (field === undefined) {
                        continue;
                    }
                    const type = field.type;
                    type.validate(this.doc, arg, this).forEach((e) => e.accept(this));
                }
            });

        if (!keepResolving) {
            return;
        }

        if (getHolderFromName("mechanic", "variableset").get().names.includes(mechanicName)) {
            let name: string;
            let scope: string;
            try {
                name = this.#interpretMlcValue(this.getFieldFromMlc(mechanic, "variableset", "name"));
                scope = this.#interpretMlcValue(this.getFieldFromMlc(mechanic, "variableset", "scope"));
            } catch {
                return;
            }
            const value = this.getFieldFromMlc(mechanic, "variableset", "value") as MlcValueExpr;

            if (scope === undefined) {
                if (VARIABLE_SCOPES.some((scope) => name.startsWith(scope + "."))) {
                    scope = name.split(".")[0];
                    name = name.slice(scope.length + 1);
                } else {
                    scope = "skill";
                }
            }

            this.#skillVariables.set(name, value);
        }
    }
    override visitTargeterExpr(targeter: TargeterExpr): void {
        const at = targeter.at;
        this.#addHighlight(at.range, SemanticTokenTypes.operator);
        const name = targeter.identifier.lexeme!;
        this.#addHighlight(targeter.identifier.range, SemanticTokenTypes.type);
        if (targeter.leftBrace) {
            this.#addHighlight(targeter.leftBrace.range, SemanticTokenTypes.operator);
        }
        for (const mlc of targeter.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (targeter.rightBrace) {
            this.#addHighlight(targeter.rightBrace.range, SemanticTokenTypes.operator);
        }
    }
    override visitTriggerExpr(trigger: TriggerExpr): void {
        const caret = trigger.caret;
        this.#addHighlight(caret.range, SemanticTokenTypes.operator);
        const name = trigger.identifier.value();
        this.#addHighlight(trigger.identifier.range, SemanticTokenTypes.function);
        if (trigger.colon) {
            this.#addHighlight(trigger.colon.range, SemanticTokenTypes.operator);
        }
        if (trigger.arg) {
            this.#addHighlightGenericString(trigger.arg, SemanticTokenTypes.string);
        }
    }
    override visitInlineConditionExpr(condition: InlineConditionExpr): void {
        const question = condition.question;
        this.#addHighlight(question.range, SemanticTokenTypes.operator);
        const name = condition.identifier.lexeme!;
        this.#addHighlight(condition.identifier.range, SemanticTokenTypes.function);
        if (condition.leftBrace) {
            this.#addHighlight(condition.leftBrace.range, SemanticTokenTypes.operator);
        }
        for (const mlc of condition.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (condition.rightBrace) {
            this.#addHighlight(condition.rightBrace.range, SemanticTokenTypes.operator);
        }
    }
    override visitMlcExpr(mlc: MlcExpr): void {
        const { identifier, equals, semicolon } = mlc;
        this.#addHighlight(identifier.range, SemanticTokenTypes.property);
        this.#addHighlight(equals.range, SemanticTokenTypes.operator);
        if (semicolon !== undefined) {
            this.#addHighlight(semicolon.range, SemanticTokenTypes.operator);
        }
        this.#resolveExpr(mlc.value);
    }
    override visitMlcValueExpr(mlcValue: MlcValueExpr): void {
        mlcValue.identifiers.forEach((v) => {
            if (!Array.isArray(v)) {
                return this.#resolveExpr(v);
            }
            v.forEach((token) => this.#addHighlight(token.range, SemanticTokenTypes.string));
        });
    }
    override visitMlcPlaceholderExpr(mlcPlaceholder: MlcPlaceholderExpr): void {
        const { greaterThanBracket, lessThanBracket } = mlcPlaceholder;
        this.#addHighlight(greaterThanBracket.range, SemanticTokenTypes.comment);
        this.#addHighlight(lessThanBracket.range, SemanticTokenTypes.comment);

        for (const identifier of mlcPlaceholder.identifiers) {
            this.#addHighlightGenericString(identifier[0], SemanticTokenTypes.comment);
            if (identifier[1] !== undefined) {
                this.#addHighlight(identifier[1].range, SemanticTokenTypes.operator);
            }
            for (const mlcExpr of identifier[2] ?? []) {
                this.visitMlcExpr(mlcExpr);
            }
            if (identifier[3] !== undefined) {
                this.#addHighlight(identifier[3].range, SemanticTokenTypes.operator);
            }
        }
        for (const dot of mlcPlaceholder.dots) {
            this.#addHighlight(dot.range, SemanticTokenTypes.comment);
        }

        if (mlcPlaceholder.identifiers.length === 1 && this.doc) {
            const [identifier] = mlcPlaceholder.identifiers[0];
            const source = identifier.value();
            // check if its a hex color
            if (source.startsWith("#") && source.length === 7) {
                const color = Color.parseHex(source);
                const range = identifier.range;
                color.ifOk((color) => {
                    this.doc?.colorHints.push(
                        new ColorHint(
                            range,
                            color,
                            `HEX Minimessage tag}`,
                            (newColor) => ({
                                range,
                                newText: newColor.toHex(),
                            }),
                            (newColor) => `HEX Minimessage tag`,
                        ),
                    );
                });
            }
        }
    }
    override visitInlineSkillExpr(inlineSkill: InlineSkillExpr): void {
        const { leftSquareBracket, rightSquareBracket } = inlineSkill;
        this.#addHighlight(leftSquareBracket.range, SemanticTokenTypes.operator);
        this.#addHighlight(rightSquareBracket.range, SemanticTokenTypes.operator);
        for (const expr of inlineSkill.skills) {
            if (expr[1].trigger !== undefined) {
                this.#addError("Inline skills cannot have triggers", expr[1].trigger);
            }
            const dash = expr[0];
            this.#addHighlight(dash.range, SemanticTokenTypes.operator);
            this.#resolveExpr(expr[1]);
        }
    }
    override visitHealthModifierExpr(healthModifier: HealthModifierExpr): void {
        const { operator, valueOrRange, range } = healthModifier;
        this.doc.addHover({
            contents: {
                kind: "markdown",
                value: stripIndentation`# Health modifier

                Inferred meaning: ${
                    healthModifier.isRange(valueOrRange)
                        ? `Health must be between ${(valueOrRange[0][0].lexeme ?? "") + (valueOrRange[0][1]?.lexeme ?? "")} and ${
                              (valueOrRange[1][0].lexeme ?? "") + (valueOrRange[1][1]?.lexeme ?? "")
                          }`
                        : `Health must be ${operator.lexeme === "=" ? "exactly" : operator.lexeme === ">" ? "greater than" : "less than"} ${
                              (valueOrRange[0].lexeme ?? "") + (valueOrRange[1]?.lexeme ?? "sdfg")
                          }`
                }

                ## See Also

                * [🔗 Wiki: Skills#Health Modifiers](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Skills)`,
            },
            range,
        });
        this.#addHighlight(operator.range, SemanticTokenTypes.operator);
        if (healthModifier.isRange(valueOrRange)) {
            const from = valueOrRange[0];
            const to = valueOrRange[1];
            for (const token of [from, to].flat()) {
                if (token === undefined) {
                    continue;
                }
                this.#addHighlight(token.range, SemanticTokenTypes.number);
            }
        } else {
            for (const token of valueOrRange) {
                if (token === undefined) {
                    continue;
                }
                this.#addHighlight(token.range, SemanticTokenTypes.number);
            }
        }
    }
    override visitGenericStringExpr(_: GenericStringExpr): void {
        todo();
    }
    #addError(message: string, expr: Expr, range = expr.range) {
        this.doc.addError(new ResolverError(this.#source, message, expr, range, this.#currentSkill).toDiagnostic());
    }
    getFieldFromMlc(mlc: ExprWithMlcs, mechanic: string, field: string) {
        let mlcValue = mlc.mlcsToMap().get(field.toString());
        for (const alias of getHolderFieldFromName(getHolderFromName("mechanic", mechanic).get(), field).get().names) {
            mlcValue ??= mlc.mlcsToMap().get(alias);
        }
        return mlcValue;
    }
    #interpretMlcValue(value: MlcValueExpr | InlineSkillExpr | undefined): string {
        if (value === undefined) {
            throw new Error("Missing value");
        }
        if (value instanceof InlineSkillExpr) {
            throw new Error("Cannot interpret MLC value with inline skills");
        }
        return value.identifiers
            .map((value) => {
                if (value instanceof MlcPlaceholderExpr) {
                    throw new Error("Cannot interpret MLC value with placeholders");
                }
                return (value as MythicToken[]).map((token) => token.lexeme).join("");
            })
            .join("");
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
