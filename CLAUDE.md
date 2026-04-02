# granola-to-minutes

One-time CLI migration tool: export Granola meetings to Minutes-native markdown.

## Build & Run

```bash
pnpm build                    # compile TypeScript
pnpm check                    # lint with Biome
node dist/cli.js export       # run full export to ~/meetings/
```

## Prerequisites

- Node.js >= 20
- `granola-cli` installed globally (`pnpm add -g granola-cli`) and authenticated (`granola auth login`)
- `claude` CLI (Claude Code) for LLM extraction (optional, use `--skip-llm` to bypass)

## Architecture

Data flows through three sources per meeting:

1. **`granola meeting list -o json`** — metadata: title, date, people, calendar event, notes (ProseMirror)
2. **`granola meeting transcript <id> -o json`** — utterances with speaker source and timestamps
3. **`granola meeting enhanced <id> -o json`** — AI summary as ProseMirror JSON

The converter transforms these into Minutes-native markdown with YAML frontmatter.

## Key Files

- `src/cli.ts` — thin CLI entry point (commander, process.exit handling)
- `src/export.ts` — orchestration: `runExport(options)` function
- `src/config.ts` — business rules and defaults (timezone, speaker map, LLM schema, slug constraints)
- `src/granola.ts` — shells out to granola-cli, parses JSON, auth retry
- `src/converter.ts` — core transformation: GranolaMeeting + transcript + enhanced -> Minutes markdown
- `src/prosemirror.ts` — ProseMirror JSON -> Markdown converter
- `src/extractor.ts` — LLM extraction via `claude -p --json-schema`
- `src/writer.ts` — atomic file writes with gray-matter
- `src/utils.ts` — shared utilities (error handling, typed error classes)
- `src/types.ts` — all TypeScript interfaces

## CLI Options

```
granola-to-minutes export [options]
  --output-dir <path>    default: ~/meetings/
  --dry-run              preview without writing
  --skip-llm             skip Claude extraction
  --note-id <id>         single meeting by UUID (prefix match)
  --since <date>         only meetings after this date
  --verbose              detailed logging
```
