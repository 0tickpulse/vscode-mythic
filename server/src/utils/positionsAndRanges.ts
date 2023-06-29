import { Comparable, DeepEquals, flattenComparison } from "tick-ts-utils";
import { Range } from "vscode-languageserver";
import { Position } from "vscode-languageserver-textdocument";
import { Range as YamlRange } from "yaml";

export class CustomPosition implements Comparable<CustomPosition>, DeepEquals {
    constructor(public line: number, public character: number) {}
    equals(other: unknown): boolean {
        if (!(other instanceof CustomPosition)) {
            return false;
        }
        return this.line === other.line && this.character === other.character;
    }
    static fromOffset(lineLengths: number[], offset: number) {
        // 0 is first line
        let line = 0;
        let character = 0;
        const len = lineLengths.length;
        for (let i = 0; i < len; i++) {
            const lineLength = lineLengths[i] + 1;
            if (offset < lineLength) {
                line = i;
                character = offset;
                break;
            }
            offset -= lineLength;
        }
        return new CustomPosition(line, character);
    }
    toOffset(lineLengths: number[]) {
        let offset = 0;
        for (let i = 0; i < this.line; i++) {
            offset += lineLengths[i] + 1;
        }
        offset += this.character;
        return offset;
    }
    compareTo(other: CustomPosition) {
        if (this.line === other.line) {
            return flattenComparison(this.character - other.character);
        }
        return flattenComparison(this.line - other.line);
    }
    withLine(line: number) {
        return new CustomPosition(line, this.character);
    }
    withCharacter(character: number) {
        return new CustomPosition(this.line, character);
    }
    add(other: CustomPosition) {
        return new CustomPosition(this.line + other.line, this.character + other.character);
    }
    addOffset(lineLengths: number[], offset: number) {
        const result = CustomPosition.fromOffset(lineLengths, this.toOffset(lineLengths) + offset);
        return result;
    }

    toString() {
        return `Position(${this.line}, ${this.character})`;
    }
    /**
     * A special format for positions, used for user-facing messages.
     */
    fmt() {
        return `${this.line}:${this.character}`;
    }
}

/**
 * Handy shortcut for creating a position.
 *
 * @param line      The line number.
 * @param character The character number.
 */
export function p(line: number, character: number): CustomPosition;
/**
 * Converts a JSON position into a Position object.
 */
export function p(position: Position): CustomPosition;
export function p(line: number | Position, character?: number) {
    if (typeof line === "number") {
        return new CustomPosition(line, character as number);
    }
    return new CustomPosition(line.line, line.character);
}

export class CustomRange implements DeepEquals {
    constructor(public start: CustomPosition, public end: CustomPosition) {}
    static fromYamlRange(lineLengths: number[], range: YamlRange) {
        //         return new CustomRange(CustomPosition.fromOffset(source, range[0]), CustomPosition.fromOffset(source, range[1]));
        return new CustomRange(CustomPosition.fromOffset(lineLengths, range[0]!), CustomPosition.fromOffset(lineLengths, range[1]!));
    }
    equals(other: unknown): boolean {
        if (!(other instanceof CustomRange)) {
            return false;
        }
        return this.start.equals(other.start) && this.end.equals(other.end);
    }
    getFrom(source: string) {
        const lines = source.split("\n");
        let result = "";
        for (let i = this.start.line; i <= this.end.line; i++) {
            result += lines[i] + "\n";
        }
        return result;
    }
    withStart(start: CustomPosition) {
        return new CustomRange(start, this.end);
    }
    withEnd(end: CustomPosition) {
        return new CustomRange(this.start, end);
    }
    add(position: CustomPosition) {
        return new CustomRange(this.start.add(position), this.end.add(position));
    }
    addOffsetToStart(lineLengths: number[], offset: number) {
        return new CustomRange(this.start.addOffset(lineLengths, offset), this.end);
    }
    addOffsetToEnd(lineLengths: number[], offset: number) {
        return new CustomRange(this.start, this.end.addOffset(lineLengths, offset));
    }
    addOffset(lineLengths: number[], offset: number) {
        return new CustomRange(this.start.addOffset(lineLengths, offset), this.end.addOffset(lineLengths, offset));
    }
    toString() {
        return `Range(${this.start}, ${this.end})`;
    }
    /**
     * A special format for ranges, used for user-facing messages.
     */
    fmt() {
        return `${this.start.fmt()}-${this.end.fmt()}`;
    }
    contains(position: CustomPosition) {
        return this.start.compareTo(position) <= 0 && this.end.compareTo(position) >= 0;
    }
    /**
     * Adds offsets to multiple ranges. Faster than calling addOffset multiple times as it only splits the source once and does not use methods like toOffset which adds loops.
     */
    static addMultipleOffsets(lineLengths: number[], ranges: CustomRange[], offset: number): CustomRange[] {
        let offsetSoFar = 0;
        let line = 0;
        let character = 0;
        const len = lineLengths.length;
        for (let i = 0; i < len; i++) {
            const lineLength = lineLengths[i] + 1;
            if (offsetSoFar + lineLength > offset) {
                line = i;
                character = offset - offsetSoFar;
                break;
            }
            offsetSoFar += lineLength;
        }
        const offsetPosition = new CustomPosition(line, character);
        return ranges.map((range) => new CustomRange(range.start.add(offsetPosition), range.end.add(offsetPosition)));
    }
}

/**
 * Handy shortcut for creating a range.
 *
 * @param startLine      The line number of the start position.
 * @param startCharacter The character number of the start position.
 * @param endLine        The line number of the end position.
 * @param endCharacter   The character number of the end position.
 */
export function r(startLine: number, startCharacter: number, endLine: number, endCharacter: number): CustomRange;
/**
 * Handy shortcut for creating a range from two positions.
 *
 * @param start The start position.
 * @param end   The end position.
 */
export function r(start: CustomPosition, end: CustomPosition): CustomRange;
/**
 * Converts a JSON range into a Range object.
 */
export function r(range: Range): CustomRange;
export function r(
    start: CustomPosition | Range | number,
    startCharacter?: number | CustomPosition | undefined,
    endLine?: number,
    endCharacter?: number,
) {
    if (typeof start === "number") {
        return new CustomRange(p(start, startCharacter as number), p(endLine as number, endCharacter as number));
    }
    if ("start" in start) {
        return new CustomRange(p(start.start.line, start.start.character), p(start.end.line, start.end.character));
    }
    return new CustomRange(start, startCharacter as CustomPosition);
}
