# Changelog

## 0.1.0 (2026-04-02)

### Added
- Initial release: CLI tool to export Granola meetings to Minutes-native markdown
- Fetches meeting metadata, AI summaries, transcripts, and human notes via `granola-cli`
- Converts ProseMirror JSON to markdown (ported converter from granola-cli)
- Structured extraction of action items, decisions, and intents via `claude -p --json-schema`
- YAML frontmatter with attendee names, speaker map, calendar events, duration
- Transcript formatting with speaker labels and relative timestamps (`[SPEAKER_N M:SS]`)
- CLI options: `--dry-run`, `--skip-llm`, `--note-id`, `--since`, `--verbose`
- Atomic file writes with collision handling
