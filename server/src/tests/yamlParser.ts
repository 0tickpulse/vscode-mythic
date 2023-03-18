import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "../yaml/parser/parser.js";

const document = TextDocument.create("file:///Users/username/Projects/mythic-language-server/plugins/MythicMobs/Skills/a.yml", "mythic", 0, `
A:
    Skills:
    - message{}
`);

console.log(JSON.stringify(parse(document), null, 4));
