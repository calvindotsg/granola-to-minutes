# Reusable Patterns

> Patterns from granola-to-minutes that apply to any TypeScript CLI project.
> Reference this repo with `--add-dir` or by path when starting a new project.

## Copy directly (adjust versions)

- `vitest.config.ts` -- coverage config, thresholds, globals
- `biome.json` -- formatter, linter rules, test domain override
- `.github/workflows/test.yml` -- lint + build + test CI
- `.github/workflows/release.yml` -- release-please with GitHub App token + npm publish via OIDC trusted publishing
- `release-please-config.json` -- changelog sections for conventional commits
- `CONTRIBUTING.md` -- dev setup, commit conventions, PR process
- `LICENSE` -- MIT license (adjust copyright year and holder)

## Follow patterns (adapt field values)

- `package.json` -- `files`, `repository`, `homepage`, `bugs`, `prepublishOnly`, `bin` with shebang, `engines`
- `src/cli.ts` -- dynamic version via `createRequire`, signal handlers, `addHelpText` with exit codes/examples

## Follow structure

- README.md progressive disclosure: quick start table -> commands reference -> output format -> how it works
- CLAUDE.md layout: quick commands -> architecture -> key files -> implementation patterns -> reusable patterns
- Branch protection: repository ruleset via `gh api` (deletion block, force push block, required PRs, required status checks)

## Adapt (change types to match project)

- `tests/fixtures.ts` -- factory pattern with `makeX(overrides?)` and shared sample data
- Commit scopes table in CONTRIBUTING.md

## Project-specific (do not copy)

- `src/granola.ts` -- Granola CLI wrapper
- `src/config.ts` -- speaker map, timezone, Granola-specific business rules
- Minutes consumer contract in Implementation Patterns
