# granola-to-minutes

CLI migration tool that exports [Granola](https://granola.ai) meeting data — AI summaries, transcripts, and human notes stored server-side — and converts it to [Minutes](https://github.com/calvindotsg/minutes)-native markdown that can be fully indexed, searched, and analyzed.

## Quick Start

| I need to... | Command | Details |
|---|---|---|
| Run full export | `pnpm build && node dist/cli.js export` | [Usage](#usage) |
| Preview without writing | `node dist/cli.js export --dry-run` | [Usage](#usage) |
| Export single meeting | `node dist/cli.js export --note-id <uuid>` | [Usage](#usage) |
| Run tests | `pnpm test:cov` | [Testing](#testing) |
| Understand the code | See architecture | [CLAUDE.md](./CLAUDE.md) |

## Prerequisites

- **Node.js** >= 20
- **granola-cli** — `pnpm add -g granola-cli && granola auth login`
- **Claude Code** (optional) — for structured extraction of action items, decisions, and intents from AI summaries

## Install

```bash
git clone https://github.com/calvindotsg/granola-to-minutes.git
cd granola-to-minutes
pnpm install
pnpm build
```

## Usage

```bash
# Full export to ~/meetings/
node dist/cli.js export

# Dry run (preview without writing)
node dist/cli.js export --dry-run

# Skip LLM extraction
node dist/cli.js export --skip-llm

# Single meeting by UUID (prefix match)
node dist/cli.js export --note-id <uuid>

# Only recent meetings
node dist/cli.js export --since 2026-03-01

# Verbose logging
node dist/cli.js export --verbose
```

## Commands Reference

| Command | Purpose |
|---|---|
| `pnpm build` | Compile TypeScript |
| `pnpm check` | Lint with Biome |
| `pnpm test` | Run test suite |
| `pnpm test:cov` | Run tests with coverage (75% threshold) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm format` | Auto-format source files |

## Output Format

Each meeting produces a markdown file with YAML frontmatter compatible with Minutes:

```yaml
---
title: Weekly Sync
type: meeting
date: '2026-03-17T14:30:00+08:00'
duration: 30m
source: granola-reimport
status: complete
attendees:
  - Alice Smith
  - Bob Jones
people:
  - John Smith
  - Alice Smith
  - Bob Jones
speaker_map:
  - speaker_label: SPEAKER_0
    name: John Smith
    confidence: high
    source: deterministic
  - speaker_label: SPEAKER_1
    name: Remote participants
    confidence: low
    source: deterministic
calendar_event: Weekly Sync
---
## Summary

[AI-generated summary]

## Notes

[Human notes from Granola]

## Transcript

[SPEAKER_0 0:00] Hello everyone.
[SPEAKER_1 0:05] Thanks for joining.
```

## How It Works

1. Lists all meetings via `granola meeting list -o json` (rich metadata)
2. For each meeting, fetches transcript and AI-enhanced summary
3. Converts ProseMirror JSON (Granola's note format) to markdown
4. Optionally extracts structured action items/decisions via Claude
5. Writes Minutes-native markdown files with proper frontmatter

## Testing

Tests use [Vitest](https://vitest.dev/) with v8 coverage. Coverage threshold is 75%.

```bash
pnpm test:cov    # run with coverage report
pnpm test:watch  # watch mode for development
```

## License

MIT
