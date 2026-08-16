# granola-to-minutes

[![exports to minutes](https://img.shields.io/badge/exports%20to-minutes-7C3AED)](https://github.com/silverstein/minutes#want-transcripts-and-ai-summaries)
[![npm version](https://img.shields.io/npm/v/granola-to-minutes)](https://www.npmjs.com/package/granola-to-minutes)
[![CI](https://img.shields.io/github/actions/workflow/status/calvindotsg/granola-to-minutes/test.yml?branch=main)](https://github.com/calvindotsg/granola-to-minutes/actions)
[![last commit](https://img.shields.io/github/last-commit/calvindotsg/granola-to-minutes)](https://github.com/calvindotsg/granola-to-minutes/commits/main)
[![license](https://img.shields.io/npm/l/granola-to-minutes)](./LICENSE)

CLI migration tool that exports [Granola](https://granola.ai) meeting data — AI summaries, transcripts, and human notes — to [Minutes](https://github.com/silverstein/minutes)-native markdown with YAML frontmatter. Extracts structured action items and decisions via Claude. Designed for one-time bulk migration from Granola's server-side storage.

![granola-to-minutes demo](https://raw.githubusercontent.com/calvindotsg/granola-to-minutes/main/demo/demo.gif)

## Features

- Full meeting data extraction: AI summaries, transcripts, human notes
- Minutes-native markdown output with YAML frontmatter
- Optional Claude-powered extraction of action items, decisions, and intents
- Dry-run preview, single-meeting, and date-filtered exports
- Machine-readable JSON output for scripting and AI agents
- Atomic file writes with collision handling

## Quick Start

| I need to... | Command | Details |
|---|---|---|
| Run full export | `npx granola-to-minutes export` | [Usage](#usage) |
| Preview without writing | `npx granola-to-minutes export --dry-run` | [Usage](#usage) |
| Export single meeting | `npx granola-to-minutes export --note-id <uuid>` | [Usage](#usage) |
| Machine-readable output | `npx granola-to-minutes export --json` | [Usage](#usage) |
| Run tests | `pnpm test:cov` | [Testing](#testing) |
| Understand the code | See architecture | [CLAUDE.md](./CLAUDE.md) |

## Prerequisites

- **Node.js** >= 22.12
- **[granola-cli](https://github.com/magarcia/granola-cli)** (community-built, not affiliated with Granola Labs) — `pnpm add -g granola-cli && granola auth login`
- **Claude Code** (optional) — for structured extraction of action items, decisions, and intents from AI summaries

## Install

Run directly without installing (recommended for one-time use):

```bash
npx granola-to-minutes export
```

Or install globally:

```bash
npm install -g granola-to-minutes    # npm
pnpm add -g granola-to-minutes       # pnpm
```

### From source

```bash
git clone https://github.com/calvindotsg/granola-to-minutes.git
cd granola-to-minutes
pnpm install
pnpm build
```

## Usage

> Commands below assume global install. Prefix with `npx` if running without installing.

```bash
# Full export to ~/meetings/
granola-to-minutes export

# Dry run (preview without writing)
granola-to-minutes export --dry-run

# Skip LLM extraction
granola-to-minutes export --skip-llm

# Single meeting by UUID (prefix match)
granola-to-minutes export --note-id <uuid>

# Only recent meetings
granola-to-minutes export --since 2026-03-01

# Verbose logging
granola-to-minutes export --verbose

# Machine-readable JSON output (for AI agents and scripts)
granola-to-minutes export --json
```

## Commands Reference

| Command | Purpose |
|---|---|
| `pnpm build` | Compile TypeScript |
| `pnpm check` | Lint with Biome |
| `pnpm test` | Run test suite |
| `pnpm test:cov` | Run tests with coverage (90% threshold) |
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

## See Also

Minutes has a built-in file-based import — `minutes import granola` — that reads from `~/.granola-archivist/output/` without any API calls. See the [comparison table](https://github.com/silverstein/minutes#want-transcripts-and-ai-summaries) in the Minutes README for when to use each tool.

## Testing

Tests use [Vitest](https://vitest.dev/) with v8 coverage. Coverage threshold is 90% (85% for branches).

```bash
pnpm test:cov    # run with coverage report
pnpm test:watch  # watch mode for development
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code style, and commit conventions.

## License

MIT
