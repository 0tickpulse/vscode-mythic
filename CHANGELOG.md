# Changelogs

## 1.9.2

- Added inclusive range support for numbers. This means that errors will be more specific.
- SemanticTokens now returns null if parsing is not done instead of an empty array. This fixes a bug where all semantic tokens will be removed between edits and the next parse.
- Updated README
- Extension now automatically detects MythicMobs configuration YAML files. This means that you no longer have to manually set the language mode.

## 1.9.1

- Fixed an issue where errors would be duplicated
- Made some SchemaValidationErrors' messages better

## 1.9.0

- Internal code cleanup
- Goto definition support
- Goto reference support
- Improved the MythicSkill schema
- Added hover with inference for health modifiers
- Extension now fully scans the workspace when activated
- Parsing is now split into two steps, each individually iterating over all queued files. This improves IntelliSense.

## 1.8.4

- Finalized the new performance optimizations
- Internal code cleanup

## 1.8.3

- Experimental new performance optimizations

## 1.8.2

- Add an example to `message`.

## 1.8.1

- Fixed a bug with offsets in multi-line skills

## 1.8.0

- More optimizations
- Fixed an infinite loop bug with skill parsing
- Re-enabled the Resolver while searching for mitigation for the performance issues

## 1.7.2

- A lot of optimizations
- Temporarily disabled the Resolver due to performance issues

...

## 1.6.0

- Added some marketplace information
