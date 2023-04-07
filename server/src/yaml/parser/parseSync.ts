import { TextDocument } from "vscode-languageserver-textdocument";
import { parseDocument } from "yaml";
import { CustomPosition, CustomRange } from "../../utils/positionsAndRanges.js";
import picomatch from "picomatch";
import { PATH_MAP } from "../schemaSystem/data.js";
import { DocumentInfo } from "./parser.js";
import { expose } from "threads";

export function parseSync({ uri, languageId, version, source }: Pick<TextDocument, "uri" | "languageId" | "version"> & { source: string }) {
    const document = TextDocument.create(uri, languageId, version, source);
    const documentInfo = new DocumentInfo(document, parseDocument(source));
    const { yamlAst } = documentInfo;
    const { contents } = yamlAst;
    if (contents === null) {
        return documentInfo;
    }

    console.time("parse (finding schema)");
    PATH_MAP.forEach((schema, pathMatcher) => {
        if (picomatch(pathMatcher)(uri)) {
            documentInfo.setSchema(schema);
        }
    });
    console.timeEnd("parse (finding schema)");

    const { schema } = documentInfo;
    documentInfo.yamlAst.errors.forEach((error) =>
        documentInfo.addError({
            message: error.message,
            range: new CustomRange(CustomPosition.fromOffset(source, error.pos[0]), CustomPosition.fromOffset(source, error.pos[1])),
            severity: 1,
            source: "Mythic Language Server",
        }),
    );
    if (!schema.isEmpty()) {
        console.time(`parse (schema validation) (${schema.get().toString()})})`);
        // console.log(`Schema found for ${uri}: ${schema.get().getDescription()}`);
        const errors = schema.get().validateAndModify(documentInfo, yamlAst.contents!);
        console.timeEnd(`parse (schema validation) (${schema.get().toString()})})`);
        console.time("parse (adding errors)");
        errors.forEach(
            (error) =>
                error.range !== null &&
                documentInfo.addError({
                    message: error.message,
                    range: error.range,
                    severity: 1,
                    source: "Mythic Language Server",
                }),
        );
        console.timeEnd("parse (adding errors)");
    }

    return documentInfo;
}

export type ParseSync = { parseSync: typeof parseSync };

expose({
    parseSync,
});
