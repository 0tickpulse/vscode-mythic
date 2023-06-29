# Changelogs

## Unreleased

### Changed

- The parse schedule timer is now dynamically adjusted based on the number of files in the workspace. This means that for smaller workspaces, the extension should generally be more responsive.

### Removed

- The `mythicyaml` language mode is no longer needed. The extension now automatically detects MythicMobs configuration YAML files.

### Fixed

- Fixed a bug where the global skills list would not be cleared properly.

## 1.9.3 - 2023-06-28

### Added

- Partial schema for mob configurations
- Partial schema for item configurations
- Color picker for item options

### Changed

- Dramatic performance improvements
  - Technical details: A large proportion of performance overhead originates from conversion between various position formats (offset and line/column). Each conversion splits the string into an array of lines, which is very expensive. This has been fixed by caching the line lengths of each file.
- Code organization
  - All schemas have been moved to individual files
  - Yaml schema classes have their names shortened (e.g. `YamlSchemaString` -> `YString`)

## 1.9.2 - 2023-06-27

### Added

- Added inclusive range support for numbers. This means that errors will be more specific.

### Changed

- SemanticTokens now returns null if parsing is not done instead of an empty array. This fixes a bug where all semantic tokens will be removed between edits and the next parse.
- Updated README
- Extension now automatically detects MythicMobs configuration YAML files. This means that you no longer have to manually set the language mode.

## 1.9.1 - 2023-06-26

- Fixed an issue where errors would be duplicated
- Made some SchemaValidationErrors' messages better

## 1.9.0 - 2023-06-25

- Internal code cleanup
- Goto definition support
- Goto reference support
- Improved the MythicSkill schema
- Added hover with inference for health modifiers
- Extension now fully scans the workspace when activated
- Parsing is now split into two steps, each individually iterating over all queued files. This improves IntelliSense.

## 1.8.4 - 2023-06-12

- Finalized the new performance optimizations
- Internal code cleanup

## 1.8.3 - 2023-06-12

- Experimental new performance optimizations

## 1.8.2 - 2023-05-09

- Add an example to `message`.

## 1.8.1 - 2023-04-17

- Fixed a bug with offsets in multi-line skills

## 1.8.0 - 2023-04-16

- More optimizations
- Fixed an infinite loop bug with skill parsing
- Re-enabled the Resolver while searching for mitigation for the performance issues

## 1.7.2 - 2023-04-01

- A lot of optimizations
- Temporarily disabled the Resolver due to performance issues

... and a lot more. I forgot to update this changelog.

## 1.6.0 - 2023-03-18

- Added some marketplace information
