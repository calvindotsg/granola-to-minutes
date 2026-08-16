# Changelog

## [1.0.0](https://github.com/calvindotsg/granola-to-minutes/compare/v0.4.3...v1.0.0) (2026-08-16)


### ⚠ BREAKING CHANGES

* **repo:** drops Node 20 (EOL 2026-04-30); commander 15 requires >=22.12.0

### Features

* **src:** report transcript-only status when a meeting has no summary ([#30](https://github.com/calvindotsg/granola-to-minutes/issues/30)) ([97efdb1](https://github.com/calvindotsg/granola-to-minutes/commit/97efdb15f9f250a1ced9266381d195e207b99185))


### Miscellaneous Chores

* **repo:** require Node &gt;= 22.12 and upgrade the toolchain ([#25](https://github.com/calvindotsg/granola-to-minutes/issues/25)) ([5629226](https://github.com/calvindotsg/granola-to-minutes/commit/5629226034841071c2289c1734a2458e76cf16d3))

## [0.4.3](https://github.com/calvindotsg/granola-to-minutes/compare/v0.4.2...v0.4.3) (2026-04-10)


### Miscellaneous Chores

* **repo:** release 0.4.3 ([#20](https://github.com/calvindotsg/granola-to-minutes/issues/20)) ([002ca17](https://github.com/calvindotsg/granola-to-minutes/commit/002ca178f18dc785dfab076502b9654b5c96d16b))

## [0.4.2](https://github.com/calvindotsg/granola-to-minutes/compare/v0.4.1...v0.4.2) (2026-04-09)


### Bug Fixes

* **github:** upgrade npm-publish job to Node 24 for OIDC compatibility ([#13](https://github.com/calvindotsg/granola-to-minutes/issues/13)) ([05f2b41](https://github.com/calvindotsg/granola-to-minutes/commit/05f2b41ed6fd1a305483e62be9976c88e50fcf2a))

## [0.4.1](https://github.com/calvindotsg/granola-to-minutes/compare/v0.4.0...v0.4.1) (2026-04-09)


### Miscellaneous Chores

* **repo:** release 0.4.1 ([#11](https://github.com/calvindotsg/granola-to-minutes/issues/11)) ([d0ced8f](https://github.com/calvindotsg/granola-to-minutes/commit/d0ced8f036c96d58e16fd2c1ea5e42da4e7c14e7))

## [0.4.0](https://github.com/calvindotsg/granola-to-minutes/compare/v0.3.0...v0.4.0) (2026-04-05)


### Features

* **repo:** prepare package for npm publication ([353c9e8](https://github.com/calvindotsg/granola-to-minutes/commit/353c9e8e8587e55fdcdb3765f9b99aa1e81980a8))
* **repo:** prepare package for npm publication ([#5](https://github.com/calvindotsg/granola-to-minutes/issues/5)) ([353c9e8](https://github.com/calvindotsg/granola-to-minutes/commit/353c9e8e8587e55fdcdb3765f9b99aa1e81980a8))
* **src:** add --json output, rich help text, and input validation ([3118f12](https://github.com/calvindotsg/granola-to-minutes/commit/3118f12bb618e77f77f7eff7945ba0fe9ba4ef29))


### Bug Fixes

* **src:** harden file writes and external subprocess handling ([a8fd54a](https://github.com/calvindotsg/granola-to-minutes/commit/a8fd54aa5108e8b1e0b537412d3304fc53446b0a))

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
