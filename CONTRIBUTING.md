# Contributing

## Development Setup

```bash
git clone https://github.com/calvindotsg/granola-to-minutes.git
cd granola-to-minutes
pnpm install
pnpm build
```

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
pnpm check          # lint
pnpm format         # auto-format
```

Biome runs on both `src/` and `tests/`. Fix all lint errors before committing.

## Testing

```bash
pnpm test           # run tests
pnpm test:cov       # run with coverage (90% threshold)
pnpm test:watch     # watch mode
```

All new code should include tests. Pure functions go in `tests/unit/`, anything requiring mocked I/O goes in `tests/integration/`.

### The Minutes contract suite

`tests/contract/` checks that what this tool writes still satisfies [Minutes](https://github.com/silverstein/minutes), the consumer of its output. It validates against a vendored copy of the schema Minutes publishes, in two layers: the `convertMeeting()` object, and a file written by the real `writeMinutesFile()` then read back the way Minutes reads it.

If you change anything that affects frontmatter — `src/converter.ts`, `src/config.ts`, `src/writer.ts`, or `src/types.ts` — run `pnpm test` and expect this suite to have an opinion.

### Refreshing the vendored Minutes schema

`tests/contract/minutes-frontmatter.schema.json` is a byte-identical copy of upstream and must stay that way, so drift diffs are readable. Do not hand-edit it. To refresh:

```bash
curl -sSL -o tests/contract/minutes-frontmatter.schema.json \
  https://raw.githubusercontent.com/silverstein/minutes/main/schema/meeting.schema.json
pnpm test
```

Then update the version, date, and SHA-256 in [`tests/contract/PROVENANCE.md`](./tests/contract/PROVENANCE.md) **and re-pin the hashes in [`tests/contract/upstream-watch.json`](./tests/contract/upstream-watch.json)** in the same change. If the refresh adds a new `format`, register it in `contract.test.ts` — ajv runs in strict mode and throws on formats it does not know.

### Drift monitoring

`.github/workflows/contract-drift.yml` compares three pinned upstream artifacts against what Minutes serves today, and opens a deduplicated issue when any of them moves. Run the same check locally:

```bash
node scripts/check-contract-drift.mjs   # exit 0 in sync, 1 drift, 2 upstream unreachable
```

It runs weekly, on every push to `main`, and on demand. The push trigger is load-bearing: **GitHub disables scheduled workflows on public repos after 60 days of repository inactivity**, and this repo has gone quiet that long before. If that happens, GitHub shows a banner on the Actions tab — re-enable the workflow from there.

## Commit Conventions

Use [Conventional Commits v1.0.0](https://www.conventionalcommits.org/) with required scope:

```text
<type>(<scope>): <subject>
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`

**Scopes for this project:**

| Scope | Pattern | Description |
|---|---|---|
| `src` | `src/**/*.ts` | Source code or tests exercising source modules |
| `repo` | `package.json`, `biome.json`, `vitest.config.ts`, `.gitignore` | Repository configuration |
| `github` | `.github/workflows/**`, `release-please-config.json` | GitHub Actions and release config |
| `root` | `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `llms.txt`, `docs/` | Root-level documentation |
| `deps` | any dependency or action version bump | Reserved for Dependabot — see below |

`deps` is the scope [`.github/dependabot.yml`](./.github/dependabot.yml) generates (`prefix: ci` / `prefix: chore` plus
`include: scope`), so Dependabot PRs arrive titled `ci(deps):` or `chore(deps):` and are merged under that
title unchanged. Keeping it distinct from `github` and `repo` is the point: it separates version bumps from
hand-written changes to the same files in the changelog. Do not use `deps` for a change you wrote yourself.

**Examples:**

```text
feat(src): add meeting deduplication by ID
fix(src): correct timezone offset for DST transitions
test(src): add edge case tests for slug generation
docs(root): update README with new CLI options
chore(repo): update biome to v3
ci(github): add Node 22 to test matrix
```

The same format applies to your **PR title**, which matters more than the individual commits
— see [Pull Requests](#pull-requests) for why.

## Pull Requests

The `main` branch is protected by a [repository ruleset](https://github.com/calvindotsg/granola-to-minutes/rules). All changes must go through a pull request:

1. Create a feature branch from `main`
2. Make your changes with tests
3. Push and open a PR targeting `main`
4. The **test** CI job must pass before merge
5. Merge with **squash** — it is the only method enabled on this repository

Direct pushes, force pushes, and branch deletion on `main` are blocked.

### Squash is the only merge method, and that makes the PR title load-bearing

Merge commits and rebase merges are disabled in the repository's settings, so
`gh pr merge --merge` and `--rebase` fail with `405 Merge commits are not allowed on
this repository`. Note that the ruleset linked above lists all three methods as allowed —
that is not a contradiction to argue with. Repository settings decide which methods exist at
all; a ruleset can only subtract from that set, never add to it. A method the settings
disable stays disabled no matter what the ruleset says, so believe the settings.

Because the squash commit takes its subject from the **PR title** (and its body from the PR
description), the PR title is what actually lands on `main` — and therefore what
release-please parses for the changelog and the version bump. So:

- **The PR title must itself be a valid conventional commit**, scope included. A PR titled
  "Fix the exporter" produces an unparseable commit on `main` and is silently dropped from
  the changelog.
- **The individual commits in your branch are collapsed and never reach the changelog.**
  Splitting a branch into `feat(src)`, `test(src)`, and `docs(root)` commits is still good
  for review, but only one of those types can survive the squash — pick the title that
  describes the change as a whole, and pick the type that carries the largest bump.
- A `BREAKING CHANGE:` footer must appear in the **PR description**, not only in a branch
  commit, or the major bump is lost. On `0.x` see `bump-minor-pre-major` in
  `release-please-config.json` before assuming what it will do.
