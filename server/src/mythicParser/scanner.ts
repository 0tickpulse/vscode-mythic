import { Range } from "vscode-languageserver-textdocument";
import { SyntaxError } from "../errors.js";
import { CustomPosition, CustomRange, NumericRange, r } from "../utils/positionsAndRanges.js";

export const TOKEN_TYPE = [
    "LeftSquareBracket",
    "RightSquareBracket",
    "LeftBrace",
    "RightBrace",
    "Semicolon",
    "Equal",
    "Dash",
    "At",
    "Tilde",
    "Question",
    "Exclamation",
    "Colon",
    "LessThan",
    "GreaterThan",
    "Dot",
    "Percent",
    "Identifier",
    "String",
    "Number",
    "Space",
    "Eof",
] as const;

export type MythicTokenType = typeof TOKEN_TYPE[number];

function maxLength(values: string[]) {
    let maxLength = 0;
    for (const value of values) {
        if (value.length > maxLength) {
            maxLength = value.length;
        }
    }
    return maxLength;
}

export class MythicToken {
    range: NumericRange;
    constructor(
        readonly source: string,
        readonly type: MythicTokenType,
        readonly lexeme: string | undefined,
        readonly literal: string | undefined,
        readonly line: number,
        readonly start: number,
        readonly current: number,
    ) {
        this.range = new NumericRange(start, current);
    }

    toString() {
        return `${this.type.padEnd(maxLength(Object.values(TOKEN_TYPE)))} ${this.lexeme} (${this.literal})`;
    }

    length() {
        return this.lexeme !== undefined ? this.lexeme.length : 0;
    }

    getLine(offset = 0) {
        return CustomPosition.fromOffset(this.source, this.current + offset).line + 1;
    }
}

export type MythicScannerResult = {
    tokens?: MythicToken[];
    errors?: SyntaxError[];
    source: string;
};

export function hasErrors(result: MythicScannerResult): boolean {
    return (result.errors?.length ?? 0) > 0;
}

/**
 * The MythicSkillLineScanner is responsible for taking a string of Mythic Skill Line code and turning it into a list of tokens.
 */
export class MythicScanner {
    /* eslint-disable @typescript-eslint/naming-convention */
    /* literally why */
    #CHAR_ACTIONS: { [key: string]: (scanner: MythicScanner) => void } = {
        "[": (scanner: MythicScanner) => scanner.#addToken("LeftSquareBracket"),
        "]": (scanner: MythicScanner) => scanner.#addToken("RightSquareBracket"),
        "{": (scanner: MythicScanner) => scanner.#addToken("LeftBrace"),
        "}": (scanner: MythicScanner) => scanner.#addToken("RightBrace"),
        ";": (scanner: MythicScanner) => scanner.#addToken("Semicolon"),
        "=": (scanner: MythicScanner) => scanner.#addToken("Equal"),
        "-": (scanner: MythicScanner) => scanner.#addToken("Dash"),
        "@": (scanner: MythicScanner) => scanner.#addToken("At"),
        "~": (scanner: MythicScanner) => scanner.#addToken("Tilde"),
        "?": (scanner: MythicScanner) => scanner.#addToken("Question"),
        "!": (scanner: MythicScanner) => scanner.#addToken("Exclamation"),
        ":": (scanner: MythicScanner) => scanner.#addToken("Colon"),
        "<": (scanner: MythicScanner) => scanner.#addToken("LessThan"),
        ">": (scanner: MythicScanner) => scanner.#addToken("GreaterThan"),
        ".": (scanner: MythicScanner) => scanner.#addToken("Dot"),
        "%": (scanner: MythicScanner) => scanner.#addToken("Percent"),
        " ": (scanner: MythicScanner) => scanner.#addToken("Space"),
        "\r": () => {},
        "\t": () => {},
        "\n": (scanner: MythicScanner) => scanner.#line++,
        '"': (scanner: MythicScanner) => scanner.#string(),
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    #tokens: MythicToken[] = [];
    #start = 0;
    #current = 0;
    #line = 1;
    #source: string;

    constructor(source: string) {
        this.#source = source;
    }

    scanTokens(): MythicScannerResult {
        try {
            while (!this.#isAtEnd()) {
                this.#start = this.#current;
                this.scanToken();
            }
            this.#tokens.push(new MythicToken(this.#source, "Eof", "", "", this.#line, this.#start, this.#current));
            return { tokens: this.#tokens, errors: [], source: this.#source };
        } catch (e: unknown) {
            return { errors: [e as SyntaxError], source: this.#source };
        }
    }

    scanToken(): void {
        const c = this.#advance();
        this.#CHAR_ACTIONS[c] !== undefined ? this.#CHAR_ACTIONS[c](this) : this.#isDigit(c) ? this.#number() : this.#identifier();
    }

    #string(): void {
        while (this.#peek() !== '"' && !this.#isAtEnd()) {
            if (this.#peek() === "\n") {
                this.#line++;
            }
            this.#advance();
        }
        if (this.#isAtEnd()) {
            throw new SyntaxError(this.#getCurrentRange(), this.#source, "Unterminated string.");
        }
        // closing "
        this.#advance();
        const value = this.#source.substring(this.#start + 1, this.#current - 1);
        this.#addToken("String", value);
    }

    #isDigit(c: string): boolean {
        return c >= "0" && c <= "9";
    }

    #number(): void {
        while (this.#isDigit(this.#peek())) {
            this.#advance();
        }
        if (this.#peek() === "." && this.#isDigit(this.#peekNext())) {
            this.#advance();
            while (this.#isDigit(this.#peek())) {
                this.#advance();
            }
        }
        const value = this.#source.substring(this.#start, this.#current);
        this.#addToken("Number", value);
    }

    #identifier(): void {
        while (!Object.keys(this.#CHAR_ACTIONS).includes(this.#peek()) && !this.#isAtEnd()) {
            this.#advance();
        }
        const text = this.#source.substring(this.#start, this.#current);
        this.#addToken("Identifier");
    }

    #isAlpha(c: string): boolean {
        return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
    }

    #isAtEnd(): boolean {
        return this.#current >= this.#source.length;
    }

    #advance(): string {
        const output = this.#source.charAt(this.#current);
        this.#current++;
        return output;
    }

    #peek(): string {
        if (this.#isAtEnd()) {
            return "\0";
        }
        return this.#source.charAt(this.#current);
    }

    #peekNext(): string {
        if (this.#current + 1 >= this.#source.length) {
            return "\0";
        }
        return this.#source.charAt(this.#current + 1);
    }

    #addToken(type: MythicTokenType, literal?: string): void {
        const text = this.#source.substring(this.#start, this.#current);
        // get line chr by subtracting the last newline from the current position
        const lineChr = this.#current - this.#source.lastIndexOf("\n", this.#current);
        this.#tokens.push(new MythicToken(this.#source, type, text, literal, this.#line, this.#start, this.#current));
    }

    #getCurrentRange(): NumericRange {
        return new NumericRange(this.#start, this.#current);
    }
}
