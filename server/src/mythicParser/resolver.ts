import { VARIABLE_SCOPES, data, typedData } from "../minecraftData/data.js";
import { MythicField, MythicHolder } from "../minecraftData/models.js";
import {
    getAllMechanicsAndAliases,
    getAllFieldNames,
    getHolderFromName,
    getHolderFieldFromName,
    validate,
    MechanicsAndAliases,
    generateHover,
} from "../minecraftData/services.js";
import { ResolverError, UnknownMechanicResolverError } from "../errors.js";
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
import { Hover, SemanticTokenTypes } from "vscode-languageserver";
import { DocumentInfo } from "../yaml/parser/parser.js";
import { CustomRange, r } from "../utils/positionsAndRanges.js";
import { Optional } from "tick-ts-utils";
import { Highlight } from "../colors.js";

export class Resolver extends ExprVisitor<void> {
    #source: string = "";
    #hovers: Hover[] = [];
    #errors: ResolverError[] = [];
    #characters: Map<CustomRange, SemanticTokenTypes> = new Map();
    #skillVariables: Map<string, MlcValueExpr | SkillLineExpr> = new Map();
    #currentSkill: SkillLineExpr | undefined = undefined;
    #expr: Optional<Expr> = Optional.empty();
    constructor() {
        super();
    }
    setAst(expr: Expr) {
        this.#expr = Optional.of(expr);
        this.#source = expr.parser.result.source;
    }
    resolveWithDoc(doc: DocumentInfo, initialOffset: CustomRange) {
        this.#hovers = [];
        this.#errors = [];
        this.#characters = new Map();
        this.resolve();
        this.#hovers.forEach((hover) => {
            doc.addHover({ ...hover, range: r(hover.range!).add(initialOffset.start) });
        });
        this.#errors.forEach((error) => {
            doc.addError({ ...error.toDiagnostic(), range: r(error.range!).add(initialOffset.start) });
        });
        this.#characters.forEach((color, range) => {
            doc.addHighlight(new Highlight(range.add(initialOffset.start), color));
        });
    }
    #addHighlight(range: CustomRange, color: SemanticTokenTypes) {
        this.#characters.set(range, color);
    }
    #addHighlightGenericString(genericString: GenericStringExpr, color: SemanticTokenTypes) {
        this.#addHighlight(genericString.getRange(), color);
    }
    resolve() {
        this.#resolveExpr();

        return this.#errors;
    }
    #resolveExpr(expr: Expr | null | undefined = this.#expr.get()): void {
        if (!expr) {
            return;
        }
        return expr.accept(this);
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
            this.#addHighlight(chance.getRange(), SemanticTokenTypes.number);
        }
    }
    override visitMechanicExpr(mechanic: MechanicExpr): void {
        const mechanicName = mechanic.identifier.value();
        this.#addHighlight(mechanic.getNameRange(), SemanticTokenTypes.function);
        if (mechanic.leftBrace) {
            this.#addHighlight(mechanic.leftBrace.getRange(), SemanticTokenTypes.operator);
        }
        for (const mlc of mechanic.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (mechanic.rightBrace) {
            this.#addHighlight(mechanic.rightBrace.getRange(), SemanticTokenTypes.operator);
        }

        if (!getAllMechanicsAndAliases().includes(mechanicName)) {
            !mechanicName.toLowerCase().startsWith("skill:") && this.#errors.push(new UnknownMechanicResolverError(this.#source, mechanic, this.#currentSkill));
            return;
        }
        this.#hovers.push({
            ...generateHover("mechanic", mechanicName, getHolderFromName("mechanic", mechanicName).get()),
            range: mechanic.getNameRange(),
        });

        /** Whether to keep resolving */
        let keepResolving = true;
        const mechanicData: MythicHolder = getHolderFromName("mechanic", mechanicName).get();
        if (mechanicData.fields !== undefined) {
            const fieldsAndAliases = getAllFieldNames("mechanic", mechanicName);
            for (const [key, arg] of mechanic.mlcsToTokenMap()) {
                if (!fieldsAndAliases.includes(key.lexeme ?? "")) {
                    this.#addError(
                        `Unknown field '${key.lexeme ?? ""}' for mechanic '${mechanicName}'`,
                        arg,
                        arg.getRange().withStart(key.getRange().start),
                    );
                }
                this.#resolveExpr(arg);
            }
            for (const [name, { required }] of Object.entries(mechanicData.fields)) {
                if (required && !fieldsAndAliases.some((value) => mechanic.mlcsToMap().has(value))) {
                    this.#addError(`Missing required field '${name}' for mechanic '${mechanicName}'`, mechanic, mechanic.getNameRange());
                    keepResolving = false;
                }
            }
        }
        if (!keepResolving) {
            return;
        }

        if (mechanicData.fields !== undefined) {
            for (const [key, arg] of mechanic.mlcsToMap()) {
                if (arg instanceof InlineSkillExpr) {
                    continue;
                }
                if (arg.identifiers.some((value) => value instanceof MlcPlaceholderExpr)) {
                    continue;
                }
                const value = arg.identifiers.map((value) => (value as MythicToken[]).map((token) => token.lexeme)).join("");
                const field = getHolderFieldFromName(mechanicData, key).otherwise(undefined);
                if (field === undefined) {
                    continue;
                }
                const type = field.type;
                const validationResults = validate(type, arg);
                if (validationResults.length > 0) {
                    this.#addError(
                        `Invalid value '${value}' for field '${key}' of mechanic '${mechanicName}'. ${validationResults.join(" ")}`,
                        arg,
                        arg.getRange(),
                    );
                }
            }
        }

        if (!keepResolving) {
            return;
        }

        if (getHolderFromName("mechanic", "variableSet").get().names.includes(mechanicName)) {
            let name: string;
            let scope: string;
            try {
                name = this.#interpretMlcValue(this.getFieldFromMlc(mechanic, "variableSet", "name"));
                scope = this.#interpretMlcValue(this.getFieldFromMlc(mechanic, "variableSet", "scope"));
            } catch {
                return;
            }
            const value = this.getFieldFromMlc(mechanic, "variableSet", "value") as MlcValueExpr;

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
        this.#addHighlight(at.getRange(), SemanticTokenTypes.operator);
        const name = targeter.identifier.lexeme!;
        this.#addHighlight(targeter.identifier.getRange(), SemanticTokenTypes.type);
        if (targeter.leftBrace) {
            this.#addHighlight(targeter.leftBrace.getRange(), SemanticTokenTypes.operator);
        }
        for (const mlc of targeter.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (targeter.rightBrace) {
            this.#addHighlight(targeter.rightBrace.getRange(), SemanticTokenTypes.operator);
        }
    }
    override visitTriggerExpr(trigger: TriggerExpr): void {
        const caret = trigger.caret;
        this.#addHighlight(caret.getRange(), SemanticTokenTypes.operator);
        const name = trigger.identifier.value();
        this.#addHighlight(trigger.identifier.getRange(), SemanticTokenTypes.function);
        if (trigger.colon) {
            this.#addHighlight(trigger.colon.getRange(), SemanticTokenTypes.operator);
        }
        if (trigger.arg) {
            this.#addHighlightGenericString(trigger.arg, SemanticTokenTypes.string);
        }
    }
    override visitInlineConditionExpr(condition: InlineConditionExpr): void {
        const question = condition.question;
        this.#addHighlight(question.getRange(), SemanticTokenTypes.operator);
        const name = condition.identifier.lexeme!;
        this.#addHighlight(condition.identifier.getRange(), SemanticTokenTypes.function);
        if (condition.leftBrace) {
            this.#addHighlight(condition.leftBrace.getRange(), SemanticTokenTypes.operator);
        }
        for (const mlc of condition.mlcs ?? []) {
            this.visitMlcExpr(mlc);
        }
        if (condition.rightBrace) {
            this.#addHighlight(condition.rightBrace.getRange(), SemanticTokenTypes.operator);
        }
    }
    override visitMlcExpr(mlc: MlcExpr): void {
        const { identifier, equals, semicolon } = mlc;
        this.#addHighlight(identifier.getRange(), SemanticTokenTypes.property);
        this.#addHighlight(equals.getRange(), SemanticTokenTypes.operator);
        if (semicolon !== undefined) {
            this.#addHighlight(semicolon.getRange(), SemanticTokenTypes.operator);
        }
        mlc.value.accept(this);
    }
    override visitMlcValueExpr(mlcValue: MlcValueExpr): void {
        mlcValue.identifiers.forEach((v) => {
            if (!Array.isArray(v)) {
                return this.#resolveExpr(v);
            }
            v.forEach((token) => this.#addHighlight(token.getRange(), SemanticTokenTypes.string));
        });
    }
    override visitMlcPlaceholderExpr(mlcValue: MlcPlaceholderExpr): void {
        const { greaterThanBracket, lessThanBracket } = mlcValue;
        this.#addHighlight(greaterThanBracket.getRange(), SemanticTokenTypes.comment);
        this.#addHighlight(lessThanBracket.getRange(), SemanticTokenTypes.comment);

        for (const identifier of mlcValue.identifiers) {
            this.#addHighlightGenericString(identifier[0], SemanticTokenTypes.comment);
            if (identifier[1] !== undefined) {
                this.#addHighlight(identifier[1].getRange(), SemanticTokenTypes.operator);
            }
            for (const mlcExpr of identifier[2] ?? []) {
                this.visitMlcExpr(mlcExpr);
            }
            if (identifier[3] !== undefined) {
                this.#addHighlight(identifier[3].getRange(), SemanticTokenTypes.operator);
            }
        }
        for (const dot of mlcValue.dots) {
            this.#addHighlight(dot.getRange(), SemanticTokenTypes.comment);
        }
    }
    override visitInlineSkillExpr(inlineSkill: InlineSkillExpr): void {
        const { leftSquareBracket, rightSquareBracket } = inlineSkill;
        this.#addHighlight(leftSquareBracket.getRange(), SemanticTokenTypes.operator);
        this.#addHighlight(rightSquareBracket.getRange(), SemanticTokenTypes.operator);
        for (const expr of inlineSkill.skills) {
            if (expr[1].trigger !== undefined) {
                this.#addError("Inline skills cannot have triggers", expr[1].trigger);
            }
            const dash = expr[0];
            this.#addHighlight(dash.getRange(), SemanticTokenTypes.operator);
            this.#resolveExpr(expr[1]);
        }
    }
    override visitHealthModifierExpr(healthModifier: HealthModifierExpr): void {
        const { operator, valueOrRange } = healthModifier;
        this.#addHighlight(operator.getRange(), SemanticTokenTypes.operator);
        if (healthModifier.isRange(valueOrRange)) {
            const from = valueOrRange[0];
            const to = valueOrRange[1];
            for (const token of [from, to].flat()) {
                if (token === undefined) {
                    continue;
                }
                this.#addHighlight(token.getRange(), SemanticTokenTypes.number);
            }
        } else {
            for (const token of valueOrRange) {
                if (token === undefined) {
                    continue;
                }
                this.#addHighlight(token.getRange(), SemanticTokenTypes.number);
            }
        }
    }
    override visitGenericStringExpr(genericString: GenericStringExpr): void {}
    #addError(message: string, expr: Expr, range = expr.getRange()) {
        this.#errors.push(new ResolverError(this.#source, message, expr, range, this.#currentSkill));
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
