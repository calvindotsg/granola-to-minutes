#!/usr/bin/env node

import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { runExport } from "./export.js";
import type { ExportOptions } from "./types.js";
import { GranolaAuthError, GranolaNotInstalledError, MeetingNotFoundError } from "./utils.js";

const program = new Command();

program
  .name("granola-to-minutes")
  .description("Export Granola meetings to Minutes-native markdown")
  .version("0.1.0");

program
  .command("export")
  .description("Export all Granola meetings to Minutes markdown files")
  .option("--output-dir <path>", "Output directory", join(homedir(), "meetings"))
  .option("--dry-run", "Preview without writing files", false)
  .option("--skip-llm", "Skip Claude extraction of action items/decisions", false)
  .option("--note-id <id>", "Export a single meeting by UUID")
  .option("--since <date>", "Only meetings created after this date")
  .option("--verbose", "Detailed logging", false)
  .action(async (opts) => {
    const options: ExportOptions = {
      outputDir: opts.outputDir,
      dryRun: opts.dryRun,
      skipLlm: opts.skipLlm,
      noteId: opts.noteId,
      since: opts.since,
      verbose: opts.verbose,
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

program.parse();
