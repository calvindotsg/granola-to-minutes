# Changelog

## [0.3.0](https://github.com/calvindotsg/granola-to-minutes/compare/v0.2.0...v0.3.0) (2026-04-04)


### Features

* **repo:** add branch protection, LICENSE, and GitHub App token ([2092319](https://github.com/calvindotsg/granola-to-minutes/commit/209231955b2b522a8bd870246bda34f575343aa0))

## [0.2.0](https://github.com/calvindotsg/granola-to-minutes/compare/v0.1.0...v0.2.0) (2026-04-03)


### Features

* **repo:** add test suite, CI, release automation, and rewrite docs ([66e3da5](https://github.com/calvindotsg/granola-to-minutes/commit/66e3da50978a128e82bc0bf12fe757afbb8a87f5))


### Bug Fixes

* **granola:** add auth retry and periodic credential refresh ([f9e481a](https://github.com/calvindotsg/granola-to-minutes/commit/f9e481a7a370fb45d455cc17c88adf09203d4652))
* **repo:** fix lint errors and exclude I/O modules from coverage ([16e5e6a](https://github.com/calvindotsg/granola-to-minutes/commit/16e5e6aeaa1c2ab0759925c447c980515cc58b9a))

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
