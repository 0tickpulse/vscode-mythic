
import { VARIABLE_SCOPES, data, typedData } from "../minecraftData/data.js";
import { MythicField, MythicHolder } from "../minecraftData/models.js";
import { getAllMechanicsAndAliases, getAllFieldNames, getHolderFromName, getHolderFieldFromName, validate, MechanicsAndAliases } from "../minecraftData/services.js";
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
    TriggerExpr
} from "./parserExpressions.js";
import { MythicToken } from "./scanner.js";

export class Resolver extends ExprVisitor<void> {
    #source: string = "";
    #errors: ResolverError[] = [];
    #skillVariables: Map<string, MlcValueExpr | SkillLineExpr> = new Map();
    #currentSkill: SkillLineExpr | undefined = undefined;
    constructor(public expr: SkillLineExpr) {
        super();
        this.#source = expr.parser.result.source ?? "";
    }
    resolve() {
        this.#resolveExpr();

        return this.#errors;
    }
    #resolveExpr(expr: Expr | null | undefined = this.expr): void {
        if (expr === null) {
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
    }
    override visitMechanicExpr(mechanic: MechanicExpr): void {
        if (!getAllMechanicsAndAliases().includes(mechanic.identifier.value())) {
            this.#errors.push(new UnknownMechanicResolverError(this.#source, mechanic, this.#currentSkill));
            return;
        }
        /** Whether to keep resolving */
        let keepResolving = true;
        const mechanicData: MythicHolder = getHolderFromName("mechanic", mechanic.identifier.value()).get();
        if (mechanicData.fields !== undefined) {
            const fieldsAndAliases = getAllFieldNames("mechanic", mechanic.identifier.value());
            for (const [key, arg] of mechanic.mlcsToTokenMap()) {
                if (!fieldsAndAliases.includes(key.lexeme ?? "")) {
                    this.#addError(`Unknown field '${key.lexeme ?? ""}' for mechanic '${mechanic.identifier.value()}'`, arg, arg.getRange().withStart(key.getRange().start));
                }
                this.#resolveExpr(arg);
            }
            for (const [name, { required }] of Object.entries(mechanicData.fields)) {
                if (required && !fieldsAndAliases.some((value) => mechanic.mlcsToMap().has(value))) {
                    this.#addError(
                        `Missing required field '${name}' for mechanic '${mechanic.identifier.value()}'`,
                        mechanic,
                        mechanic.getNameRange()
                    );
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
                const field = getHolderFieldFromName(mechanicData, key).get();
                const type = field.type;
                const validationResults = validate(type, arg);
                if (validationResults.length > 0) {
                    this.#addError(
                        `Invalid value '${value}' for field '${key}' of mechanic '${mechanic.identifier.value()}'. ${validationResults.join(" ")}`,
                        arg,
                        arg.getRange()
                    );
                }
            }
        }

        if (!keepResolving) {
            return;
        }

        if (getHolderFromName("mechanic", "variableSet").get().names.includes(mechanic.identifier.value())) {
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
    override visitTargeterExpr(targeter: TargeterExpr): void {}
    override visitTriggerExpr(trigger: TriggerExpr): void {}
    override visitInlineConditionExpr(condition: InlineConditionExpr): void {}
    override visitMlcExpr(mlc: MlcExpr): void {}
    override visitMlcValueExpr(mlcValue: MlcValueExpr): void {
        mlcValue.identifiers.filter((value): value is MlcPlaceholderExpr => !Array.isArray(value)).forEach(this.#resolveExpr);
    }
    override visitMlcPlaceholderExpr(mlcValue: MlcPlaceholderExpr): void {}
    override visitInlineSkillExpr(inlineSkill: InlineSkillExpr): void {
        for (const expr of inlineSkill.skills) {
            if (expr[1].trigger !== undefined) {
                this.#addError("Inline skills cannot have triggers", expr[1].trigger);
            }
            this.#resolveExpr(expr[1]);
        }
    }
    override visitHealthModifierExpr(healthModifier: HealthModifierExpr): void {}
    override visitGenericStringExpr(genericString: GenericStringExpr): void {}
    #addError(message: string, expr: Expr, range = expr.getRange()) {
        this.#errors.push(new ResolverError(this.#source, message, expr, range, this.#currentSkill));
    }
    getFieldFromMlc(
        mlc: ExprWithMlcs,
        mechanic: string,
        field: string
    ) {
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
