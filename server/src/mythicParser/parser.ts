// RULES
// skillLine = mechanic ( targeter | trigger | condition* );
// targeter = "@" + identifier ( + "{" + mlc + "}" );
// trigger = "~" + identifier ( + ":" + identifier ) ( + "{" + mlc + "}" );
// condition = "?" ( ( + "~" ) + "!" ) + identifier ( + "{" + mlc + "}" );
// mechanic = identifier ( + "{" + mlc + "}" );
// mlc = identifier + "=" + mlcValue ( + ";" + mlc );
// placeholder = "<" + placeholderText + ">";
// placeholderText = identifier ( + "." + placeholderText );
// inline skill = "[" + ( "-" + skillLine )* + "]"

import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { SyntaxError } from "../errors.js";
import { getAllConditionsAndAliases, getAllMechanicsAndAliases, getAllTargetersAndAliases, getHover } from "../mythicData/services.js";
import { CustomPosition } from "../utils/positionsAndRanges.js";
import {
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
import { MythicScannerResult, MythicToken, MythicTokenType } from "./scanner.js";

export class MythicSkillParseResult {
    private constructor(public skillLine?: SkillLineExpr, public errors?: SyntaxError[], public completions?: string[]) {}
    static fromSkillLine(skillLine: SkillLineExpr) {
        return new MythicSkillParseResult(skillLine);
    }
    static fromErrors(errors: SyntaxError[]) {
        return new MythicSkillParseResult(undefined, errors);
    }
    hasErrors() {
        return this.errors?.length ?? 0 > 0;
    }
    getSkillLineOrThrow() {
        if (this.skillLine === undefined) {
            throw new Error("No skill line found");
        }
        return this.skillLine;
    }
}

export class Completion {
    constructor(public completions: CompletionItem[]) {}
}

export class Parser {
    #current = 0;
    #tokens: MythicToken[];
    #isCompleting = false;
    #completions: CompletionItem[] = [];
    constructor(public result: MythicScannerResult) {
        this.#tokens = result.tokens ?? [];
    }
    completeMythicSkill(): CompletionItem[] {
        this.#isCompleting = true;
        if (this.result.errors?.length ?? 0 > 0) {
            return [];
        }
        try {
            this.#skillLine();
            return [];
        } catch (e) {
            if (e instanceof Completion) {
                return e.completions;
            }
            throw e;
        } finally {
            this.#isCompleting = false;
        }
    }
    parseMythicSkill(): MythicSkillParseResult {
        this.#current = 0;
        if (this.result.errors?.length ?? 0 > 0) {
            return MythicSkillParseResult.fromErrors(this.result.errors ?? []);
        }
        try {
            return MythicSkillParseResult.fromSkillLine(this.#skillLine());
        } catch (e) {
            if (e instanceof SyntaxError) {
                return MythicSkillParseResult.fromErrors([e]);
            }
            throw e;
        }
    }
    /**
     * Used for debugging.
     * Comment out the console.log line to disable.
     */
    #log(msg: string) {
        // console.log(`[Parser] ${msg} (current: ${this.#current})`);
    }
    #skillLine(...exitTypes: MythicTokenType[]) {
        this.#log("skillLine");
        // this.#completion(
        //     getAllMechanicsAndAliases().map((m): CompletionItem => {
        //         const item: CompletionItem = { label: m, kind: CompletionItemKind.Function };
        //         item.detail = getHover("mechanic", m).map(h => h.contents.toString()).otherwise(undefined);
        //         return item;
        //     })
        // );
        const mechanic = this.#mechanic();
        let targeter: TargeterExpr | undefined = undefined;
        let trigger: TriggerExpr | undefined = undefined;
        const conditions: InlineConditionExpr[] = [];
        let chance: MythicToken | undefined = undefined;
        let healthModifier: HealthModifierExpr | undefined = undefined;

        while (!this.#isAtEnd()) {
            this.#consumeWhitespace();
            // this.#completionGeneric(["At", "Tilde", "Question", "Number", "Equal", "GreaterThan", "LessThan", ...exitTypes]);
            if (this.#isAtEnd()) {
                break;
            }
            if (this.#matchAll("At")) {
                if (targeter === undefined) {
                    targeter = this.#targeter();
                } else {
                    throw this.#error(this.#peek(), "Duplicate targeter!");
                }
            } else if (this.#matchAll("Tilde")) {
                if (trigger === undefined) {
                    trigger = this.#trigger();
                } else {
                    throw this.#error(this.#peek(), "Duplicate trigger!");
                }
            } else if (this.#matchAll("Question")) {
                conditions.push(this.#inlineCondition());
            } else if (this.#matchAll("Number")) {
                chance = this.#previous();
            } else if (this.#checkAny("Equal", "GreaterThan", "LessThan")) {
                healthModifier = this.#healthModifier();
            } else if (this.#checkAny(...exitTypes)) {
                break;
            } else {
                throw this.#error(this.#peek(), `Expected targeter, trigger or condition! \n(For debugging) Exit types: ${exitTypes.join(", ")}.`);
            }
        }

        return new SkillLineExpr(this, this.#currentPosition(), mechanic, targeter, trigger, conditions, chance, healthModifier);
    }
    #mechanic() {
        this.#log("mechanic");
        const name = this.#genericString(["LeftBrace", "Space"], "Expected mechanic name!");
        if (name.values.length === 0) {
            throw this.#error(this.#peek(), "Expected mechanic name!");
        }
        if (this.#match("LeftBrace")) {
            const leftBrace = this.#previous();
            const mlc = this.#mlc();
            const rightBrace = this.#consume("RightBrace", "Expected '}' after mechanic mlc!");
            return new MechanicExpr(this, this.#currentPosition(), name, leftBrace, mlc, rightBrace);
        }
        return new MechanicExpr(this, this.#currentPosition(), name, undefined, [], undefined);
    }
    #targeter() {
        this.#log("targeter");
        const at = this.#previous();
        // this.#completion(
        //     getAllTargetersAndAliases().map((t): CompletionItem => {
        //         const item: CompletionItem = { label: t, kind: CompletionItemKind.Function };
        //         item.detail = getHover("targeter", t).map(h => h.contents.toString()).otherwise(undefined);
        //         return item;
        //     })
        // );
        const name = this.#consume("Identifier", "Expected targeter name!");
        // this.#completionGeneric(["{"]);
        if (this.#match("LeftBrace")) {
            const leftBrace = this.#previous();
            const mlc = this.#mlc();
            const rightBrace = this.#consume("RightBrace", "Expected '}' after targeter mlc!");
            return new TargeterExpr(this, this.#currentPosition(), at, name, leftBrace, mlc, rightBrace);
        }
        return new TargeterExpr(this, this.#currentPosition(), at, name, undefined, [], undefined);
    }
    #trigger() {
        this.#log("trigger");
        const caret = this.#previous();
        const name = this.#genericString(["LeftBrace", "Space"], "Expected trigger name!");
        let arg: GenericStringExpr | undefined = undefined;
        let colon: MythicToken | undefined = undefined;
        if (this.#match("Colon")) {
            colon = this.#previous();
            arg = this.#genericString(["LeftBrace", "Space"], "Expected trigger argument after ':'!");
        }
        return new TriggerExpr(this, this.#currentPosition(), caret, name, colon, arg);
    }
    #inlineCondition() {
        this.#log("inlineCondition");
        const question = this.#previous();
        let not = false;
        let trigger = false;
        // this.#completionGeneric(["!", "~"]);
        if (this.#match("Exclamation")) {
            not = true;
        }
        // this.#completionGeneric(not ? ["~"] : ["!", "~"]);
        if (this.#match("Tilde")) {
            trigger = true;
        }
        // this.#completion(
        //     getAllConditionsAndAliases().map((c): CompletionItem => {
        //         const item: CompletionItem = { label: c, kind: CompletionItemKind.Function };
        //         item.detail = getHover("condition", c).map(h => h.contents.toString()).otherwise(undefined);
        //         return item;
        //     })
        // );
        const name = this.#consume("Identifier", "Expected inline condition name!");
        // this.#completionGeneric(["{"]);
        if (this.#match("LeftBrace")) {
            const leftBrace = this.#previous();
            const mlc = this.#mlc();
            const rightBrace = this.#consume("RightBrace", "Expected '}' after inline condition mlc!");
            return new InlineConditionExpr(this, this.#currentPosition(), question, name, leftBrace, mlc, rightBrace, not, trigger);
        }
        return new InlineConditionExpr(this, this.#currentPosition(), question, name, undefined, [], undefined, not, trigger);
    }

    #healthModifier() {
        this.#log("healthModifier");
        // healthModifier = ( ( "<" | ">" ) + number ( + percent )? ) | ( "=" + number ( + percent )? ( + "-" + number ( + percent )? )? )\
        const operator = this.#consumeAny(["Equal", "GreaterThan", "LessThan"], "Expected health modifier operator!");
        const min: [MythicToken, MythicToken?] = [this.#consume("Number", "Expected health modifier value!")];
        if (this.#check("Percent")) {
            min.push(this.#advance());
        }
        if (operator.type === "Equal" && this.#match("Dash")) {
            const max: [MythicToken, MythicToken?] = [this.#consume("Number", "Expected second health modifier value!")];
            if (this.#check("Percent")) {
                max.push(this.#advance());
            }
            return new HealthModifierExpr(this, this.#currentPosition(), operator, [min, max]);
        }
        return new HealthModifierExpr(this, this.#currentPosition(), operator, min);
    }

    #mlc() {
        this.#log("mlc");
        const mlcs: MlcExpr[] = [];
        do {
            let semicolon: MythicToken | undefined = undefined;
            if ((this.#previous().lexeme ?? "") === ";") {
                semicolon = this.#previous();
            }
            // if no mlc is found, break
            if (this.#check("RightBrace")) {
                break;
            }
            this.#consumeWhitespace();
            const key = this.#consume("Identifier", "Expected mlc key!");
            // this.#completionGeneric(["="]);
            const equals = this.#consume("Equal", "Expected '=' after mlc key!");
            const value = this.#mlcValue(key);
            mlcs.push(new MlcExpr(this, this.#currentPosition(), key, equals, value, semicolon));
            // this.#completionGeneric([";", "}"]);
            this.#consumeWhitespace();
            // this.#completionGeneric([";", "}"]);
            this.#consumeWhitespace();
        } while (this.#match("Semicolon"));
        return mlcs;
    }
    #mlcValue(key: MythicToken) {
        this.#log("mlcValue");
        const parts: (MythicToken[] | MlcPlaceholderExpr)[] = [];
        let start = this.#current;
        // special case for inline skills
        // TODO this is a bit hacky, maybe find a better way to do this
        if (
            this.#match("LeftSquareBracket") &&
            ["skill", "skills", "s", "ontick", "onhit", "onend", "ot", "oh", "oe"].includes(key.lexeme?.toLowerCase() ?? "")
        ) {
            const inline = this.#inlineSkill();
            return inline;
        }
        while (!this.#check("Semicolon") && !this.#check("RightBrace") && !this.#isAtEnd()) {
            if (this.#match("LessThan")) {
                // remove leading <
                parts.push(this.#tokens.slice(start, this.#current - 1));
                parts.push(this.#placeholder());
                start = this.#current;
            } else if (this.#match("LeftBrace")) {
                while (!this.#match("RightBrace")) {
                    this.#advance();
                }
            } else if (this.#match("LeftSquareBracket")) {
                while (!this.#match("RightSquareBracket")) {
                    this.#advance();
                }
            } else {
                this.#advance();
            }
        }
        parts.push(this.#tokens.slice(start, this.#current));
        return new MlcValueExpr(this, this.#currentPosition(), parts);
    }
    #placeholder() {
        this.#log("placeholder");
        // genericString ( + "." + genericString )*
        const leftSquareBracket = this.#previous();
        const parts: [GenericStringExpr, MythicToken?, MlcExpr[]?, MythicToken?][] = [];
        const dots: MythicToken[] = [];
        const part: [GenericStringExpr, MythicToken?, MlcExpr[]?, MythicToken?] = [this.#genericString(["GreaterThan", "Dot", "LeftBrace"])];
        if (this.#match("LeftBrace")) {
            part.push(this.#previous());
            part.push(this.#mlc());
            part.push(this.#consume("RightBrace", "Expected '}' after placeholder mlc!"));
        }
        parts.push(part);
        // this.#completionGeneric([".", ">"]);
        while (this.#match("Dot") && !this.#isAtEnd()) {
            dots.push(this.#previous());
            const part: [GenericStringExpr, MythicToken?, MlcExpr[]?, MythicToken?] = [this.#genericString(["GreaterThan", "Dot", "LeftBrace"])];
            if (this.#match("LeftBrace")) {
                part.push(this.#previous());
                part.push(this.#mlc());
                part.push(this.#consume("RightBrace", "Expected '}' after placeholder mlc!"));
            }
            parts.push(part);
            // this.#completionGeneric([".", ">"]);
        }
        const rightSquareBracket = this.#consume("GreaterThan", "Expected '>' after placeholder!");
        return new MlcPlaceholderExpr(this, this.#currentPosition(), leftSquareBracket, parts, dots, rightSquareBracket);
    }
    #inlineSkill() {
        this.#log("inlineSkill");
        const leftSquareBracket = this.#previous();
        const dashesAndSkills: [MythicToken, SkillLineExpr][] = [];
        while (!this.#check("RightSquareBracket") && !this.#isAtEnd()) {
            // this.#completionGeneric(["- ", "]"]);
            // optional whitespace
            this.#consumeWhitespace();
            // this.#completionGeneric(["- ", "]"]);
            // dash
            const dash = this.#consume("Dash", "Expected '-' after '['!");

            // optional whitespace
            this.#consumeWhitespace();
            // skill
            const skill = this.#skillLine("RightSquareBracket", "Dash");

            // optional whitespace
            this.#consumeWhitespace();
            dashesAndSkills.push([dash, skill]);
        }
        const rightSquareBracket = this.#consume("RightSquareBracket", "Expected ']' after inline skill!");
        return new InlineSkillExpr(this, this.#currentPosition(), leftSquareBracket, dashesAndSkills, rightSquareBracket);
    }

    #genericString(end: MythicTokenType[], error = "Expected a string!") {
        this.#log("genericString");
        const start = this.#current;
        while (!this.#checkAny(...end) && !this.#isAtEnd()) {
            if (this.#check("LeftBrace")) {
                while (!this.#check("RightBrace")) {
                    this.#advance();
                }
            }
            if (this.#check("LeftSquareBracket")) {
                while (!this.#check("RightSquareBracket")) {
                    this.#advance();
                }
            }
            this.#advance();
        }
        const string = this.#tokens.slice(start, this.#current);
        if (string.length === 0) {
            throw this.#error(
                this.#peek(),
                `${error} (End: ${end.join(", ")}, start: ${start}, current: ${this.#current}, checkAny: ${this.#checkAny(...end)}, currentType ${
                    this.#peek()?.type ?? ""
                })`,
            );
            // throw this.#error(this.#peek(), error);
        }
        return new GenericStringExpr(this, this.#currentPosition(), string);
    }

    #consume(type: MythicTokenType, message: string): MythicToken {
        if (this.#check(type)) {
            return this.#advance();
        }
        throw this.#error(this.#peek(), `${message} (Got ${this.#peek()?.type ?? ""} '${this.#peek()?.lexeme}')`);
    }

    #consumeAny(types: MythicTokenType[], message: string): MythicToken {
        if (this.#checkAny(...types)) {
            return this.#advance();
        }
        throw this.#error(this.#peek(), `${message} (Got ${this.#peek()?.type ?? ""} '${this.#peek()?.lexeme}')`);
    }

    #consumeWhitespace() {
        while (this.#match("Space") && !this.#isAtEnd()) {
            // do nothing
        }
    }
    #match(...types: MythicTokenType[]): boolean {
        for (const type of types) {
            if (this.#check(type)) {
                this.#advance();
                return true;
            }
        }
        return false;
    }
    #matchAll(...types: MythicTokenType[]): boolean {
        for (const type of types) {
            if (!this.#check(type)) {
                return false;
            }
            this.#advance();
        }
        return true;
    }
    #matchAny(...types: MythicTokenType[]): boolean {
        for (const type of types) {
            if (this.#check(type)) {
                this.#advance();
                return true;
            }
        }
        return false;
    }
    #check(type: MythicTokenType): boolean {
        if (this.#isAtEnd()) {
            return false;
        }
        return this.#peek().type === type;
    }
    #checkAny(...types: MythicTokenType[]): boolean {
        if (this.#isAtEnd()) {
            return false;
        }
        return types.includes(this.#peek().type);
    }
    #advance(): MythicToken {
        if (!this.#isAtEnd()) {
            this.#current++;
        }
        return this.#previous();
    }
    #isAtEnd(): boolean {
        return this.#peek().type === "Eof";
    }
    #peek(): MythicToken {
        return this.#tokens[this.#current];
    }
    #peekNext(): MythicToken {
        return this.#tokens[this.#current + 1];
    }
    #previous(): MythicToken {
        return this.#tokens[this.#current - 1];
    }
    #error(token: MythicToken, message: string): SyntaxError {
        return new SyntaxError(token.range, this.result.source ?? "", message, token);
    }
    #completion(completions: CompletionItem[]): void {
        if (!this.#isCompleting) {
            return;
        }
        const offset = this.#peek().range.end;
        // this.#completions = completions;
    }
    #completionGeneric(completions: string[]): void {
        if (!this.#isCompleting) {
            return;
        }
        const offset = this.#peek().range.end;
        // this.#completions = completions.map((c) => ({
        //     label: c,
        //     kind: CompletionItemKind.Text
        // }));
    }

    #currentPosition(): CustomPosition {
        return this.#peek().range.start;
    }
}
