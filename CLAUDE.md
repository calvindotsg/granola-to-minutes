# granola-to-minutes

> Developer reference for AI agents and future Claude Code sessions. For usage and installation, see [README.md](./README.md).

## Quick Commands

| Task | Command |
|---|---|
| Build | `pnpm build` |
| Lint | `pnpm check` |
| Test | `pnpm test:cov` |
| Format | `pnpm format` |
| Run | `node dist/cli.js export` |

## Architecture

Data pipeline: `cli.ts` -> `export.ts` -> {`granola.ts`, `extractor.ts`} -> `converter.ts` -> `writer.ts`

Three data sources per meeting:

1. **`granola meeting list -o json`** -- metadata: title, date, people, calendar event, notes (ProseMirror)
2. **`granola meeting transcript <id> -o json`** -- utterances with speaker source and timestamps
3. **`granola meeting enhanced <id> -o json`** -- AI summary as ProseMirror JSON

## Key Files

- `src/cli.ts` -- thin CLI entry point (Commander, process.exit handling)
- `src/export.ts` -- orchestration: `runExport(options)` function
- `src/config.ts` -- business rules and defaults (timezone, speaker map, LLM schema, slug constraints)
- `src/granola.ts` -- shells out to granola-cli, parses JSON, auth retry
- `src/converter.ts` -- core transformation: GranolaMeeting + transcript + enhanced -> Minutes markdown
- `src/prosemirror.ts` -- ProseMirror JSON -> Markdown converter (recursive, not a library)
- `src/extractor.ts` -- LLM extraction via `claude -p --json-schema`
- `src/writer.ts` -- atomic file writes with gray-matter
- `src/utils.ts` -- shared utilities (error handling, typed error classes)
- `src/types.ts` -- all TypeScript interfaces

## Implementation Patterns

These are non-obvious decisions and gotchas not discoverable by reading the code alone:

- **Timezone is hardcoded to Singapore UTC+8.** `config.ts` defines `TIMEZONE.offsetMinutes = 480`. All date conversions in `converter.ts` use `toLocalDate()` which applies this offset manually. There is no locale detection.
- **Speaker attribution is binary.** Granola only provides `microphone` vs `system` audio source, not individual speaker IDs. SPEAKER_0 = meeting creator (from `people.creator`), SPEAKER_1 = "Remote participants" (everyone else). This is a Granola limitation, not a design choice.
- **Auth tokens expire during long runs.** `granola.ts` catches 401 errors and re-runs `granola auth login` before retrying. Credentials refresh every 10 minutes (`AUTH_REFRESH_INTERVAL_MS`). This was added after tokens expired during 25+ minute export runs.
- **500ms rate limiting between API calls.** `granola.ts` adds a `DELAY_MS` pause before each transcript/enhanced API call to avoid overwhelming granola-cli.
- **Atomic writes via tmp+rename.** `writer.ts` writes to a `.tmp` file then renames, ensuring no partial files on disk. Collision handling appends `-2`, `-3`, etc. up to 99 attempts.
- **LLM extraction is optional.** `extractor.ts` checks for `claude` CLI availability once (cached at module level in `claudeAvailable`). Returns null on any failure, never blocks the export pipeline.
- **Module-level state.** `extractor.ts` caches `claudeAvailable` and `granola.ts` caches `lastAuthRefresh` at module scope. Tests that exercise these need `vi.resetModules()` between test cases.
- **Minutes consumer contract.** The output must satisfy Minutes parser requirements: `title`, `type`, `date`, `duration` are required frontmatter fields. `status` must be `"complete"`, `"no-speech"`, or `"transcript-only"`. `action_items` status must be `"open"` or `"done"`. See Minutes source at `crates/reader/src/parse.rs`.
- **Branch protection via ruleset.** `main` is protected by a repository ruleset (`main-protection`) requiring PRs and the `test` CI check to pass. No bypass actors — all rules apply to everyone including repo admin. Managed via `gh api repos/calvindotsg/granola-to-minutes/rulesets` — do not use legacy branch protection rules.

## Dependencies & Testing

**Runtime:** commander, gray-matter
**Dev:** TypeScript 6, Biome v2, Vitest + @vitest/coverage-v8
**Testing:** `pnpm test:cov` -- 75% coverage threshold, unit tests in `tests/unit/`, integration tests in `tests/integration/`

## Reusable Patterns

This repo serves as a reference pattern for future TypeScript CLI projects. When starting a new project, reference this repo with `--add-dir` or by path.

**Copy directly** (adjust versions):
- `vitest.config.ts` -- coverage config, thresholds, globals
- `biome.json` -- formatter, linter rules, test domain override
- `.github/workflows/test.yml` -- lint + build + test CI
- `.github/workflows/release.yml` -- release-please with GitHub App token for CI triggering
- `release-please-config.json` -- changelog sections for conventional commits
- `CONTRIBUTING.md` -- dev setup, commit conventions, PR process
- `LICENSE` -- MIT license (adjust copyright year and holder)

**Follow structure:**
- README.md progressive disclosure: quick start table -> commands reference -> output format -> how it works
- CLAUDE.md layout: quick commands -> architecture -> key files -> implementation patterns -> reusable patterns
- Branch protection: repository ruleset via `gh api` (deletion block, force push block, required PRs, required status checks)

**Adapt** (change types to match project):
- `tests/fixtures.ts` -- factory pattern with `makeX(overrides?)` and shared sample data
- Commit scopes table in CONTRIBUTING.md

**Project-specific (do not copy):**
- `src/granola.ts` -- Granola CLI wrapper
- `src/config.ts` -- speaker map, timezone, Granola-specific business rules
- Minutes consumer contract in Implementation Patterns
