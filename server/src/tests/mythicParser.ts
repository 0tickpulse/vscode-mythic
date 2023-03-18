import { getAst } from "../mythicParser/main.js";

console.log(getAst("message{m=HI} @Server").getSkillLineOrThrow().printAST());
