# Biome v2 Config Migration Research

## Sources

* https://biomejs.dev/guides/upgrade-to-biome-v2/
* https://biomejs.dev/reference/configuration/
* https://biomejs.dev/assist/actions/organize-imports/

## Findings

* Biome's v2 upgrade guide recommends running `biome migrate --write` and highlights breaking config changes.
* The v2 guide states that old `ignore` and `include` options were removed and replaced by `includes`.
* Biome v2 globs are relative to the configuration file, not the shell working directory.
* `files.ignoreUnknown` remains valid in Biome v2.
* `organizeImports` is now configured as an assist source action: `assist.actions.source.organizeImports`.

## Repo Mapping

* The root `biome.json` had no actual ignore patterns, only an empty `files.ignore` array.
* The migrated `files.includes` should avoid Trellis/runtime/archive metadata and `packages/foliate-js` because the package spec documents separate ESLint formatting preferences for that submodule.
* Enabling `vcs.useIgnoreFile` lets Biome avoid generated `dist`, `target`, and dependency directories already listed in `.gitignore`.
* The root config remains the right location for app-level Biome configuration unless package-specific configs are later introduced.
