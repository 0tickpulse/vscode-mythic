import { TextDocument } from "vscode-languageserver-textdocument";
import { parseSync } from "../yaml/parser/parseSync.js";

const document = TextDocument.create("file:///Users/username/Projects/mythic-language-server/plugins/MythicMobs/Skills/a.yml", "mythic", 0, `
A:
    Skills:
    - message{}
`);

console.log(JSON.stringify(parseSync(document), null, 4));
