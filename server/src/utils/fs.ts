import { readdir } from "fs/promises";
import { join } from "path";
import { FILE_EXTENSIONS } from "../documentManager.js";

export async function recursive_search(dir: string) : Promise<string[]> {
    const files = await readdir(dir, { withFileTypes: true });
    const result: string[] = [];
    for (const file of files) {
        if (file.isDirectory()) {
            const subfiles = await recursive_search(join(dir, file.name));
            result.push(...subfiles);
        } else {
            result.push(join(dir, file.name));
        }
    }
    return result;
}

export function isMythicFile(file: string) {
    return FILE_EXTENSIONS.some((ext) => file.endsWith(ext));
}
