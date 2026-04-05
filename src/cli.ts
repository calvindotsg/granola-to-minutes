#!/usr/bin/env node

import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { runExport } from "./export.js";
import type { ExportOptions } from "./types.js";
import { GranolaAuthError, GranolaNotInstalledError, MeetingNotFoundError } from "./utils.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

process.on("unhandledRejection", (reason) => {
  console.error("Fatal:", reason instanceof Error ? reason.message : String(reason));
  process.exit(1);
});

process.on("SIGINT", () => {
  console.error("\nInterrupted");
  process.exit(130);
});

const program = new Command();

program
  .name("granola-to-minutes")
  .description("Export Granola meetings to Minutes-native markdown")
  .version(version);

program
  .command("export")
  .description("Export all Granola meetings to Minutes markdown files")
  .option("--output-dir <path>", "Output directory", join(homedir(), "meetings"))
  .option("--dry-run", "Preview without writing files", false)
  .option("--skip-llm", "Skip Claude extraction of action items/decisions", false)
  .option("--note-id <id>", "Export a single meeting by UUID or prefix")
  .option(
    "--since <date>",
    "Only export meetings created after this ISO 8601 date (e.g. 2026-03-01)",
  )
  .option("--verbose", "Detailed logging", false)
  .option("--json", "Output results as JSON to stdout (machine-readable)", false)
  .action(async (opts) => {
    const options: ExportOptions = {
      outputDir: opts.outputDir,
      dryRun: opts.dryRun,
      skipLlm: opts.skipLlm,
      noteId: opts.noteId,
      since: opts.since,
      verbose: opts.verbose,
      json: opts.json,
    };

    try {
      await runExport(options);
    } catch (err) {
      if (err instanceof GranolaNotInstalledError) {
        console.error(err.message);
        process.exit(1);
      }
      if (err instanceof GranolaAuthError) {
        console.error(err.message);
        process.exit(2);
      }
      if (err instanceof MeetingNotFoundError) {
        console.error(err.message);
        process.exit(4);
      }
      throw err;
    }
  });

program.addHelpText(
  "after",
  `
Prerequisites:
  granola-cli    Install: pnpm add -g granola-cli && granola auth login
  claude (opt)   For structured extraction of action items/decisions

Exit codes:
  0  Success
  1  granola-cli not installed
  2  Granola authentication failed
  4  Meeting not found

Examples:
  $ granola-to-minutes export
  $ granola-to-minutes export --dry-run
  $ granola-to-minutes export --since 2026-03-01 --verbose
  $ granola-to-minutes export --note-id abc123 --skip-llm
  $ granola-to-minutes export --json
`,
);

program.parse();
