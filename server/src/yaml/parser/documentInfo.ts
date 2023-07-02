import { Optional } from "tick-ts-utils";
import { CompletionItem, Diagnostic, Hover } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Document, parseDocument } from "yaml";
import { ColorHint, Highlight } from "../../colors.js";
import { CustomPosition, CustomRange, r } from "../../utils/positionsAndRanges.js";
import { YamlSchema } from "../schemaSystem/schemaTypes.js";
import { URI } from "vscode-uri";
import { globalData } from "../../documentManager.js";
import { info } from "console";
import { dbg } from "../../utils/logging.js";
import { CachedMythicSkill } from "../../mythicModels.js";

/**
 * Describes a link between two ranges in two documents.
 * Used, for example, with goto definition and goto references.
 */
export class RangeLink {
    constructor(public fromRange: CustomRange, public targetRange: CustomRange, public targetDoc: DocumentInfo) {}
    toString() {
        return `RangeLink(${this.fromRange} -> ${this.targetDoc} ${this.targetRange})`;
    }
}

export class Dependency {
    constructor(public doc: DocumentInfo, public range: CustomRange) {
        this.id = doc.uri + ":" + range.toString();
    }
    getSource() {
        return this.doc.source;
    }
    dependencies: Dependency[] = [];
    dependents: Dependency[] = [];
    id: string;
    addDependency(dependency: Dependency) {
        dbg("Dependency", `Adding dependency ${dependency.id} to ${this.id}`)
        this.dependencies.push(dependency);
        dependency.dependents.push(this);
    }
}

export class DocumentInfo {
    /** cached source */
    source: string;
    hovers: Hover[] = [];
    schema: Optional<YamlSchema> = Optional.empty();
    errors: Diagnostic[] = [];
    // highlights: Map<number, Color> = new Map();
    highlights: Highlight[] = [];
    gotoDefinitions: RangeLink[] = [];
    gotoReferences: RangeLink[] = [];
    colorHints: ColorHint[] = [];
    lineLengths: number[];
    autoCompletions: CompletionItem[] = [];
    uri: string;
    cachedMythicSkills: CachedMythicSkill[] = [];
    constructor(
        public base: TextDocument,
        public yamlAst: Document = parseDocument(base.getText(), { keepSourceTokens: true }),
        hovers?: Hover[],
        schema?: YamlSchema,
        errors?: Diagnostic[],
    ) {
        this.source = base.getText();
        this.uri = base.uri;
        this.hovers = hovers ?? [];
        this.schema = Optional.of(schema);
        this.errors = errors ?? [];
        this.lineLengths = this.source.split("\n").map((line) => line.length);
    }
    setSchema(schema: YamlSchema) {
        this.schema = Optional.of(schema);
    }
    addHover(hover: Hover) {
        this.hovers.push(hover);
    }
    addError(error: Diagnostic) {
        dbg("DocumentInfo", `Adding error ${error.message} to ${this.uri}`)
        this.errors.push({
            range: error.range,
            message: error.message,
            severity: error.severity,
            source: error.source,
            code: error.code,
        });
        // only have the necessary properties
        // since typescript's type system is structural, any object with the same properties is considered the same type
        // therefore, some undesirable properties might be present in the object
        // this is especially significant given that the object will be serialized and sent over the network
        // which leads to two problems:
        // 1. unnecessary data is sent over the network
        // 2. the object might not be serializable (e.g. if it contains cyclic references)
    }
    addHighlight(highlight: Highlight) {
        if (highlight.range.start.line === highlight.range.end.line) {
            this.highlights.unshift(highlight);
            return;
        }

        const lines = highlight.range.getFrom(this.base.getText()).split("\n");

        let lastChar = highlight.range.start.character;
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length;
            const range = new CustomRange(
                new CustomPosition(highlight.range.start.line + i, lastChar),
                new CustomPosition(highlight.range.start.line + i, lastChar + lineLength),
            );
            this.highlights.unshift(new Highlight(range, highlight.color));
            lastChar = 0;
        }
    }
    addGotoDefinitionAndReverseReference(definition: RangeLink) {
        this.gotoDefinitions.push(definition);
        definition.targetDoc.gotoReferences.push(new RangeLink(definition.targetRange, definition.fromRange, this));
    }
    getHoversAt(position: CustomPosition): Hover[] {
        return this.hovers.filter((hover) => r(hover.range!).contains(position));
    }
    toString() {
        return `DocumentInfo(${this.base.uri})`;
    }
    fmt() {
        return URI.parse(this.base.uri).fsPath;
    }
    getAllDependencies() {
        // MYTHIC SKILLS
        return this.cachedMythicSkills.flatMap((skill) => skill.dependencies);
    }
    getAllDependents() {
        // MYTHIC SKILLS
        return this.cachedMythicSkills.flatMap((skill) => skill.dependents);
    }
    /**
     * Traverse all dependencies of this document. If those documents have dependencies, they will be traversed as well, and so on recursively.
     * The callback is called for each document, and is guaranteed to be called only once for each document.
     * Cyclic dependencies are handled correctly.
     *
     * @param callback The callback to call for each document.
     */
    traverseDependencies(callback: (doc: Dependency) => void) {
        const visited = new Set<string>();
        const queue = this.getAllDependencies();
        while (queue.length > 0) {
            const dependency = queue.shift()!;
            if (visited.has(dependency.id)) {
                continue;
            }
            visited.add(dependency.id);
            callback(dependency);
            queue.push(...dependency.dependencies);
        }
    }
    /**
     * Traverse all dependents of this document. If those documents have dependents, they will be traversed as well, and so on recursively.
     * The callback is called for each document, and is guaranteed to be called only once for each document.
     * Cyclic dependencies are handled correctly.
     *
     * @param callback The callback to call for each document.
     */
    traverseDependents(callback: (doc: Dependency) => void) {
        const visited = new Set<string>();
        const queue = this.getAllDependents();
        info("DocumentInfo", `Traversing at least ${queue.length} dependents of ${this.uri}`)
        while (queue.length > 0) {
            const dependency = queue.shift()!;
            if (visited.has(dependency.doc.uri)) {
                continue;
            }
            visited.add(dependency.doc.uri);
            info("DocumentInfo", `Traversing dependents of ${this.uri}: ${dependency.doc.uri}`)
            callback(dependency);
            queue.push(...dependency.dependents);
        }
    }
}
