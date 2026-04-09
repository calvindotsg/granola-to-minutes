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
pnpm test:cov       # run with coverage (75% threshold)
pnpm test:watch     # watch mode
```

All new code should include tests. Pure functions go in `tests/unit/`, anything requiring mocked I/O goes in `tests/integration/`.

## Commit Conventions

Use [Conventional Commits v1.0.0](https://www.conventionalcommits.org/) with required scope:

```
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

**Examples:**

```
feat(src): add meeting deduplication by ID
fix(src): correct timezone offset for DST transitions
test(src): add edge case tests for slug generation
docs(root): update README with new CLI options
chore(repo): update biome to v3
ci(github): add Node 22 to test matrix
```

## Pull Requests

The `main` branch is protected by a [repository ruleset](https://github.com/calvindotsg/granola-to-minutes/rules). All changes must go through a pull request:

1. Create a feature branch from `main`
2. Make your changes with tests
3. Push and open a PR targeting `main`
4. The **test** CI job must pass before merge
5. Merge using any strategy (merge, squash, or rebase)

Direct pushes, force pushes, and branch deletion on `main` are blocked.
