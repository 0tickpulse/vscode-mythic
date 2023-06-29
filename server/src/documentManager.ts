import { TextDocuments } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentInfo } from "./yaml/parser/documentInfo.js";
import { CachedMythicSkill } from "./mythicModels.js";

export const FILE_EXTENSIONS = [".yml", ".yaml", ".mythic"];

export const globalData = {
    documents: {
        manager: new TextDocuments(TextDocument),
        list: new Map<string, DocumentInfo>(),
        getDocument(uri: string) {
            return this.list.get(uri);
        },
        set(doc: DocumentInfo) {
            this.list.set(doc.base.uri, doc);
        },
    },
    mythic: {
        /**
         * A cached registry of Mythic skills as a map of document URI to skill.
         */
        skills: {
            map: new Map<string, CachedMythicSkill[]>(),
            add(skill: CachedMythicSkill) {
                const skills = this.map.get(skill.path.base.uri);
                if (skills) {
                    skills.push(skill);
                } else {
                    this.map.set(skill.path.base.uri, [skill]);
                }
            },
            all() {
                const skills: CachedMythicSkill[] = [];
                for (const skillList of this.map.values()) {
                    skills.push(...skillList);
                }
                return skills;
            },
        },
    },
    flush(uri: string) {
        this.documents.list.delete(uri);
        this.mythic.skills.map.delete(uri);
    },
};
