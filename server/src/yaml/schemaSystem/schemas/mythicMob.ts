import mobTypes from "../bigData/mobTypes.js";
import { YMap, YObj, YUnion, YString, YNum, YBool, YArr, YMythicSkill, YamlSchema } from "../schemaTypes.js";

export const mythicMobSchema: YamlSchema = new YMap(
    new YObj({
        Type: {
            schema: YUnion.literals(...mobTypes).setName("mob_type"),
            required: true,
            description:
                "The entity type of the mob.\n\n## See Also\n\n* [🔗 Wiki: Mobs#Type](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#Type)",
        },
        Display: {
            schema: new YString(),
            required: false,
            description:
                "The display name of the mob. Supports MiniMessage.\n\n##See Also\n\n* [🔗 Wiki: Mobs#Display](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#Display)",
        },
        Health: {
            schema: new YNum(0, undefined, true),
            required: false,
            description:
                "The base health of the mob. Note that it caps at `2048` unless set otherwise in your server's `spigot.yml`.\n\n## See Also\n\n* [🔗 Wiki: Mobs#Health](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#Health)",
        },
        Damage: {
            schema: new YNum(0, undefined, true),
            required: false,
            description:
                "The base damage of the mob. 1 damage = 0.5 hearts.\n\n## See Also\n\n* [🔗 Wiki: Mobs#Damage](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#Damage)",
        },
        Armor: {
            schema: new YNum(0, 30, true, true),
            required: false,
            description:
                "The base armor of the mob. Note that it caps at `30`.\n\n## See Also\n\n* [🔗 Wiki: Mobs#Armor](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#Armor)",
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
                "Creates a basic healthbar hologram for the mob. Requires plugin [🔗 Holograms](https://www.spigotmc.org/resources/holograms.4924/) or [🔗 HolographicDisplays](https://dev.bukkit.org/projects/holographic-displays).\n\n## See Also\n\n* [🔗 Wiki: Mobs#HealthBar](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#HealthBar)",
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
                "Optionally configure a bossbar for the mob.\n\n## See Also\n\n* [🔗 Wiki: Mobs#BossBar](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#BossBar)\n* [🔗 Wiki: Mobs/BossBar](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/BossBar)",
        },
        Faction: {
            schema: new YString(), // TODO: Have the list of factions be dynamically generated from the workspace
            required: false,
            description:
                "The faction of the mob, alphanumeric and case-sensitive. This can be used for some advanced [🔗 custom AI configurations](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Custom-AI) or [🔗 target filtering](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Targeters#targeter-options).",
        },
        Options: {
            schema: new YamlSchema(), // TODO: Add options
            required: false,
            description:
                "A special field for some sub-options.\n\n## See Also\n\n* [🔗 Wiki: Mobs#Options](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#Options)\n* [🔗 Wiki: Mobs/Options](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Options)",
        },
        Modules: {
            schema: new YObj({
                ThreatTables: {
                    schema: new YBool(),
                    required: false,
                    description:
                        "Whether to use threat tables for this mob.\n\n## See Also\n\n* [🔗 Wiki: Mobs/Threat Tables](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/ThreatTables)",
                },
                ImmunityTables: {
                    schema: new YBool(),
                    required: false,
                    description:
                        "Whether to use immunity tables for this mob.\n\n## See Also\n\n* [🔗 Wiki: Mobs/Immunity Tables](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/ImmunityTables)",
                },
            }),
            required: false,
            description:
                "A field to enable or disable certain modules like [🔗 threat tables](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/ThreatTables) or [🔗 immunity tables](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/ImmunityTables).\n\n## See Also\n\n* [🔗 Wiki: Mobs#Modules](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#Modules)",
        },
        AIGoalSelectors: {
            schema: new YArr(new YString()), // TODO: Add AI goal selectors
            required: false,
            description:
                "Modifies the AI Goals of the mob.\n\n## See Also\n\n* [🔗 Wiki: Mobs#AIGoalSelectors](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#AIGoalSelectors)\n* [🔗 Wiki: Mobs/Custom AI#AI Goal Selectors](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Custom-AI#ai-goal-selectors)",
        },
        AITargetSelectors: {
            schema: new YArr(new YString()), // TODO: Add AI target selectors
            required: false,
            description:
                "Modifies the AI Targets of the mob.\n\n## See Also\n\n* [🔗 Wiki: Mobs#AITargetSelectors](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#AITargetSelectors)\n* [🔗 Wiki: Mobs/Custom AI#AI Target Selectors](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Custom-AI#ai-target-selectors)",
        },
        Drops: {
            schema: new YArr(new YString()), // TODO: Add drops
            required: false,
            description:
                "Modifies the drops of the mob.\n\n## See Also\n\n* [🔗 Wiki: Mobs#Drops](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs#Drops)\n* [🔗 Wiki: Drops](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/drops/Drops)",
        },
        Skills: {
            schema: new YArr(new YMythicSkill(true)),
            required: false,
            description:
                "Modifies the skills of the mob.\n\n## See Also\n\n* [🔗 Wiki: Mobs#Skills](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#Skills)\n* [🔗 Wiki: Skills](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Skills/Skills)",
        },
        Disguise: {
            schema: new YString(), // TODO: Add disguises
            required: false,
            description:
                "Modifies the disguise of the mob. Requires the plugin [🔗 LibsDisguises](https://www.spigotmc.org/resources/libs-disguises-free.81/).\n\n## See Also\n\n* [🔗 Wiki: Mobs#Disguise](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Mobs#Disguise)\n* [🔗 Wiki: Mobs/Disguises](https://git.lumine.io/mythiccraft/MythicMobs/-/wikis/Mobs/Disguises)",
        },
    }),
);
