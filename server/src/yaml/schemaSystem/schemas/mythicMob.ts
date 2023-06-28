import { mdSeeAlso } from "../../../utils/utils.js";
import mobTypes from "../bigData/mobTypes.js";
import { YMap, YObj, YUnion, YString, YNum, YBool, YArr, YMythicSkill, YamlSchema } from "../schemaTypes.js";

export const mythicMobSchema: YamlSchema = new YMap(
    new YObj({
        Type: {
            schema: YUnion.literals(...mobTypes).setName("mob_type"),
            required: true,
            description:
                "The entity type of the mob." + mdSeeAlso("Mobs/Mobs#type"),
        },
        Display: {
            schema: new YString(),
            required: false,
            description:
                "The display name of the mob. Supports MiniMessage." + mdSeeAlso("Mobs/Mobs#display"),
        },
        Health: {
            schema: new YNum(0, undefined, true),
            required: false,
            description:
                "The base health of the mob. Note that it caps at `2048` unless set otherwise in your server's `spigot.yml`." + mdSeeAlso("Mobs/Mobs#health"),
        },
        Damage: {
            schema: new YNum(0, undefined, true),
            required: false,
            description:
                "The base damage of the mob. 1 damage = 0.5 hearts." + mdSeeAlso("Mobs/Mobs#damage"),
        },
        Armor: {
            schema: new YNum(0, 30, true, true),
            required: false,
            description:
                "The base armor of the mob. Note that it caps at `30`." + mdSeeAlso("Mobs/Mobs#armor"),
        },
        HealthBar: {
            schema: new YObj({
                Enabled: {
                    schema: new YBool(),
                    required: true,
                    description: "Whether the health bar is enabled.",
                },
                Offset: {
                    schema: new YNum(),
                    required: false,
                    description: "The offset of the health bar from the mob's head.",
                },
            }),
            required: false,
            description:
                "Creates a basic healthbar hologram for the mob. Requires plugin [🔗 Holograms](https://www.spigotmc.org/resources/holograms.4924/) or [🔗 HolographicDisplays](https://dev.bukkit.org/projects/holographic-displays)." + mdSeeAlso("Mobs/Mobs#healthbar"),
        },
        BossBar: {
            schema: new YObj({
                Enabled: {
                    schema: new YBool(),
                    required: true,
                    description: "Whether the bossbar is enabled.",
                },
                Title: {
                    schema: new YString(),
                    required: false,
                    description: "The title of the bossbar.",
                },
                Range: {
                    schema: new YNum(),
                    required: false,
                    description: "The range that players can see the bossbar from.",
                },
                Color: {
                    schema: YUnion.literals("PINK", "BLUE", "RED", "GREEN", "YELLOW", "PURPLE", "WHITE"),
                    required: false,
                    description: "The color of the bossbar. Case-sensitive.",
                },
                Style: {
                    schema: YUnion.literals("SOLID", "SEGMENTED_6", "SEGMENTED_10", "SEGMENTED_12", "SEGMENTED_20"),
                    required: false,
                    description: "The style of the bossbar. Case-sensitive",
                },
                CreateFog: {
                    schema: new YBool(),
                    required: false,
                    description: "Whether to create fog on the player's vision in the radius of the bossbar.",
                },
                DarkenSky: {
                    schema: new YBool(),
                    required: false,
                    description: "Whether to darken the sky in the radius of the bossbar, similar to when the Wither is spawned.",
                },
                PlayMusic: {
                    schema: new YBool(),
                    required: false,
                    description: "Whether to play music in the radius of the bossbar.",
                },
            }),
            required: false,
            description:
                "Optionally configure a bossbar for the mob." + mdSeeAlso("Mobs/Mobs#bossbar", "Mobs/Bossbar"),
        },
        Faction: {
            schema: new YString(), // TODO: Have the list of factions be dynamically generated from the workspace
            required: false,
            description:
                "The faction of the mob, alphanumeric and case-sensitive. This can be used for some advanced [🔗 custom AI configurations](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Custom-AI) or [🔗 target filtering](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Targeters#targeter-options)." + mdSeeAlso("Mobs/Mobs#faction"),
        },
        Options: {
            schema: new YamlSchema(), // TODO: Add options
            required: false,
            description:
                "A special field for some sub-options." + mdSeeAlso("Mobs/Mobs#options", "Mobs/Options"),
        },
        Modules: {
            schema: new YObj({
                ThreatTables: {
                    schema: new YBool(),
                    required: false,
                    description:
                        "Whether to use threat tables for this mob." + mdSeeAlso("Mobs/ThreatTables"),
                },
                ImmunityTables: {
                    schema: new YBool(),
                    required: false,
                    description:
                        "Whether to use immunity tables for this mob." + mdSeeAlso("Mobs/ImmunityTables"),
                },
            }),
            required: false,
            description:
                "A field to enable or disable certain modules like [🔗 threat tables](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/ThreatTables) or [🔗 immunity tables](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/ImmunityTables)." + mdSeeAlso("Mobs/Mobs#modules"),
        },
        AIGoalSelectors: {
            schema: new YArr(new YString()), // TODO: Add AI goal selectors
            required: false,
            description:
                "Modifies the AI Goals of the mob." + mdSeeAlso("Mobs/Mobs#aigoalselectors", "Mobs/Custom-AI#ai-goal-selectors"),
        },
        AITargetSelectors: {
            schema: new YArr(new YString()), // TODO: Add AI target selectors
            required: false,
            description:
                "Modifies the AI Targets of the mob." + mdSeeAlso("Mobs/Mobs#aitargetselectors", "Mobs/Custom-AI#ai-target-selectors"),
        },
        Drops: {
            schema: new YArr(new YString()), // TODO: Add drops
            required: false,
            description:
                "Modifies the drops of the mob." + mdSeeAlso("Mobs/Mobs#drops", "drops/Drops"),
        },
        Skills: {
            schema: new YArr(new YMythicSkill(true)),
            required: false,
            description:
                "Modifies the skills of the mob." + mdSeeAlso("Mobs/Mobs#skills", "Skills/Skills"),
        },
        Disguise: {
            schema: new YString(), // TODO: Add disguises
            required: false,
            description:
                "Modifies the disguise of the mob. Requires the plugin [🔗 LibsDisguises](https://www.spigotmc.org/resources/libs-disguises-free.81/)." + mdSeeAlso("Mobs/Mobs#disguise", "Mobs/Disguises"),
        },
    }),
);
