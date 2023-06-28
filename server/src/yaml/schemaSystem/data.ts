import picomatch from "picomatch";
import {
    YamlSchema as YSchema,
     YString,
     YArr,
     YMap,
     YBool,
     YMythicCondition,
     YMythicSkill,
     YNum,
     YObj,
     YUnion,
    YMythicSkillMap,
} from "./schemaTypes.js";
import materials from "./bigData/materials.js";
import { isScalar } from "yaml";
import { todo } from "../../utils/utils.js";
import { r } from "../../utils/positionsAndRanges.js";
import { mythicItemSchema } from "./schemas/mythicItem.js";
import { mythicMobSchema } from "./schemas/mythicMob.js";
import { mythicSkillSchema } from "./schemas/mythicSkill.js";


export const PATH_MAP = new Map<string, { schema: YSchema; picoMatch: picomatch.Matcher }>();

function addPath(path: string, schema: YSchema) {
    PATH_MAP.set(path, {
        schema,
        picoMatch: picomatch(path),
    });
}

// SKILLS
addPath("**/plugins/MythicMobs/Skills/*.{yml,yaml}", mythicSkillSchema);
addPath("**/plugins/MythicMobs/Packs/*/Skills/*.{yml,yaml}", mythicSkillSchema);

// MOBS
addPath("**/plugins/MythicMobs/Mobs/*.{yml,yaml}", mythicMobSchema);
addPath("**/plugins/MythicMobs/Packs/*/Mobs/*.{yml,yaml}", mythicMobSchema);

// ITEMS
addPath("**/plugins/MythicMobs/Items/*.{yml,yaml}", mythicItemSchema);
addPath("**/plugins/MythicMobs/Packs/*/Items/*.{yml,yaml}", mythicItemSchema);
