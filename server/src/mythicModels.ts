import { Node } from "yaml";

/**
 * Represents a cached Mythic Skill.
 */
export class CachedMythicSkill {
    constructor(
        /**
         * The path to the file containing the skill.
         */
        public readonly path: string,
        /**
         * The YAML AST of the skill.
         */
        public readonly node: Node,
        /**
         * The name of the skill. This is the key of the skill in the node.
         */
        public readonly name: string,
    ) {}
}
