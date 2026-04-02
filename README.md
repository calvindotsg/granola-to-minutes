# granola-to-minutes

One-time CLI migration tool that exports [Granola](https://granola.ai) meeting data (AI summaries, transcripts, human notes) and converts it to [Minutes](https://github.com/calvindotsg/minutes)-native markdown format.

## Why

Granola's local Electron cache stores only metadata shells (title, date, attendees). Full content (AI summaries, transcripts) lives server-side. This tool fetches everything via `granola-cli` and produces markdown files that Minutes can fully index, search, and analyze.

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
node dist/index.js export

# Dry run (preview without writing)
node dist/index.js export --dry-run

# Skip LLM extraction
node dist/index.js export --skip-llm

# Single meeting
node dist/index.js export --note-id <uuid>

# Only recent meetings
node dist/index.js export --since 2026-03-01
```

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

## License

MIT
