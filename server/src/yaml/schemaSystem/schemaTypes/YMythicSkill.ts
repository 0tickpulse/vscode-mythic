import { Optional } from "tick-ts-utils";
import { Node, isScalar } from "yaml";
import { getAst } from "../../../mythicParser/main.js";
import { Resolver } from "../../../mythicParser/resolver.js";
import { CustomRange } from "../../../utils/positionsAndRanges.js";
import { DocumentInfo } from "../../parser/documentInfo.js";
import { YamlSchema, SchemaValidationError } from "../schemaTypes.js";

export class YMythicSkill extends YamlSchema {
    resolver: Optional<Resolver> = Optional.empty();
    constructor(public supportsTriggers = true) {
        super();
    }
    override getDescription() {
        return "a skill" + (this.supportsTriggers ? "" : " that does not support triggers.");
    }
    override postValidate(doc: DocumentInfo, value: Node): void {
        if (!isScalar(value)) {
            return [new SchemaValidationError(this, `Expected type ${this.typeText}!`, doc, value)];
        }
        const { source, lineLengths } = doc;

        let rangeOffset = value.range!;
        if (value.type === "QUOTE_DOUBLE" || value.type === "QUOTE_SINGLE") {
            rangeOffset = [rangeOffset[0] + 1, rangeOffset[1] - 1, rangeOffset[2]];
        }
        const customRangeOffset = CustomRange.fromYamlRange(lineLengths, rangeOffset);

        const skillLine = source
            .substring(rangeOffset[0], rangeOffset[1])
            .split("\n")
            .map((line, index) => {
                if (index !== 0) {
                    return line.substring(customRangeOffset.start.character);
                }
                return line;
            })
            .join("\n");

        const ast = getAst(skillLine);
        const errors: SchemaValidationError[] = [];
        if (ast.hasErrors()) {
            errors.push(
                ...ast.errors!.map(
                    (error) => new SchemaValidationError(this, error.message, doc, value, error.range.addOffset(lineLengths, rangeOffset[0])),
                ),
            );
        }

        ast.skillLine &&
            this.resolver.ifPresent((r) => {
                r.setAst(ast.skillLine!);
                r.resolveWithDoc(doc, rangeOffset[0]);
            });

        const trigger = ast.skillLine?.trigger;
        if (trigger && !this.supportsTriggers) {
            errors.push(
                new SchemaValidationError(
                    this,
                    "Triggers cannot be used in meta-skills. They should only be used to activate meta-skills.",
                    doc,
                    value,
                    trigger.range.addOffset(lineLengths, rangeOffset[0]),
                ),
            );
        }

        return errors;
    }
    get rawTypeText() {
        return "mythicSkill";
    }
}
