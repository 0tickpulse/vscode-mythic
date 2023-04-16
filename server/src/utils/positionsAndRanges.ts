import { Comparable, flattenComparison } from "tick-ts-utils";
import { Range } from "vscode-languageserver";
import { Position } from "vscode-languageserver-textdocument";
import { Range as YamlRange } from "yaml";

export class CustomPosition implements Comparable<CustomPosition> {
    constructor(public line: number, public character: number) {}
    static fromOffset(source: string, offset: number) {
        // 0 is first line
        const lines = source.split("\n");
        let line = 0;
        let character = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1;
            if (offset < lineLength) {
                line = i;
                character = offset;
                break;
            }
            offset -= lineLength;
        }
        return new CustomPosition(line, character);
    }
    toOffset(source: string) {
        const lines = source.split("\n");
        let offset = 0;
        for (let i = 0; i < this.line; i++) {
            offset += lines[i].length + 1;
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
    addOffset(source: string, offset: number) {
        const result = CustomPosition.fromOffset(source, this.toOffset(source) + offset);
        return result;
    }

    toString() {
        return `Position(${this.line}, ${this.character})`;
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

export class CustomRange {
    constructor(public start: CustomPosition, public end: CustomPosition) {}
    static fromYamlRange(source: string, range: YamlRange) {
        return new CustomRange(CustomPosition.fromOffset(source, range[0]), CustomPosition.fromOffset(source, range[2]));
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
    addOffsetToStart(source: string, offset: number) {
        return new CustomRange(this.start.addOffset(source, offset), this.end);
    }
    addOffsetToEnd(source: string, offset: number) {
        return new CustomRange(this.start, this.end.addOffset(source, offset));
    }
    addOffset(source: string, offset: number) {
        return new CustomRange(this.start.addOffset(source, offset), this.end.addOffset(source, offset));
    }
    toString() {
        return `Range(${this.start}, ${this.end})`;
    }
    contains(position: CustomPosition) {
        return this.start.compareTo(position) <= 0 && this.end.compareTo(position) >= 0;
    }
    /**
     * Adds offsets to multiple ranges. Faster than calling addOffset multiple times as it only splits the source once and does not use methods like toOffset which adds loops.
     */
    static addMultipleOffsets(source: string, ranges: CustomRange[], offset: number): CustomRange[] {
        const lines = source.split("\n");
        let offsetSoFar = 0;
        let line = 0;
        let character = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1;
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
