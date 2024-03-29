# Changelogs

This file contains the changelogs for the MythicMobs extension.
Note that this project does not follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Intellisense for `switch` mechanic
- Intellisense for `randomskill` mechanic
- Intellisense for `skill` mechanic

### Removed

- Hovers for metaskills will no longer show where they're defined. It's unnecessary because you can make use of the goto definition feature.

### Fixed

- Fixed a bug where the RGB values for item's `Options.Color` would be multiplied by 65025 instead of 255 (i.e. multiplying by 255 twice).

## 1.9.5 - 2023-07-02

### Changed

- Ranges from the AST will automatically be shifted to the correct position. You no longer have to call `addOffset` or equivalent methods anymore.
- The type text for numbers is now more concise. Infinite bounds are now better represented - instead of `0..=∞`, it is now `0..`.
- The mob schema's `Type` is no longer required.

### Fixes

- Fixed nested inline skills not being parsed properly.
- File dependencies are now properly managed.
  - Technical details: The `DocumentInfo` class has `dependencies` and `dependents` properties. These properties are used to keep track of which files depend on which files. Previously, all `DocumentInfo`s were fully cleared when parsing, which means that dependency information was lost. However, now, before clearing all `DocumentInfo`s, the URIs of the dependencies and dependents are added to a separate queue.
- Fixed document errors retaining even after you edit the file.
- Fixed a bug where errors, highlights, etc would be applied on the wrong document.
  - Technical info: This was caused by the `Resolver` being called on the wrong document within `YArr`. On `YArr#runPostValidation`, the resolver wasn't being reset, which means that the resolver would still have the previous document's information. This was fixed by resetting the resolver before running post-validation.

## 1.9.4 - 2023-06-29

### Added

- Added color decorations to MiniMessage tags.
- Super fancy logging colors so it is clearer what is going on (it seems that VSCode's output panel doesn't support ANSI escape codes though)
- Placeholder support for most strings in most schemas (enabled by default)

### Changed

- The parse schedule timer is now dynamically adjusted based on the number of files in the workspace. This means that for smaller workspaces, the extension should generally be more responsive.

### Removed

- The `mythicyaml` language mode is no longer needed. The extension now automatically detects MythicMobs configuration YAML files.
- Removed the raw type in Schema Validation Errors. This was a debugging feature.

### Fixed

- Fixed a bug where the global skills list would not be cleared properly.
- Fixed a bug where using the color picker would lead to unexpected behavior.
- Corrected the capitalization of attribute slot names.
- Fixed a bug where MythicSkills would not be properly cached and flushed, leading to unexpected behavior.

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
