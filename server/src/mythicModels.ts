import { Node } from "yaml";
import { DocumentInfo } from "./yaml/parser/parser.js";
import { CustomRange } from "./utils/positionsAndRanges.js";

/**
 * Represents a cached Mythic Skill.
 */
export class CachedMythicSkill {
    constructor(
        /**
         * The path to the file containing the skill.
         */
        public readonly path: DocumentInfo,
        /**
         * The YAML AST of the skill, as a tuple of the key and the value.
         */
        public readonly node: [Node, Node],
        public readonly declarationRange: CustomRange,
        /**
         * The name of the skill. This is the key of the skill in the node.
         */
        public readonly name: string,
        public readonly description?: string,
    ) {}
    toString() {
        return `CachedMythicSkill(${this.name})`;
    }
}
