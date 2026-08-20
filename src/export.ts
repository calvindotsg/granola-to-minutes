import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { NOTE_ID } from "./config.js";
import { convertMeeting } from "./converter.js";
import { extractInsights } from "./extractor.js";
import { ensureAuth, getEnhanced, getTranscript, listMeetings } from "./granola.js";
import { toMarkdown } from "./prosemirror.js";
import type { ExportOptions } from "./types.js";
import {
  errorMessage,
  GranolaNotInstalledError,
  InvalidOptionError,
  MeetingNotFoundError,
  stripControlChars,
} from "./utils.js";
import { resolveExecutable } from "./which.js";
import { writeMinutesFile } from "./writer.js";

function log(quiet: boolean, ...args: unknown[]): void {
  if (!quiet) console.error(...args);
}

/** Run the full Granola → Minutes export pipeline. */
export async function runExport(options: ExportOptions): Promise<void> {
  const { outputDir, dryRun, skipLlm, noteId, since, verbose, json } = options;

  // 0. Validate the options themselves first. Everything below this point costs an auth round-trip
  // and a full account listing, and a mistyped flag should not pay for either.
  //
  // Guard on `undefined`, not truthiness: `--note-id ""` used to fall through and export the entire
  // account, which is the opposite of what the flag asks for. A prefix shorter than
  // NOTE_ID.minPrefixLength cannot meaningfully select one meeting either.
  const notePrefix = noteId?.trim();
  if (notePrefix !== undefined && notePrefix.length < NOTE_ID.minPrefixLength) {
    throw new InvalidOptionError(
      `--note-id needs at least ${NOTE_ID.minPrefixLength} characters ` +
        "(a full meeting UUID, or a prefix of one).",
    );
  }

  let sinceDate: number | undefined;
  if (since !== undefined) {
    sinceDate = new Date(since).getTime();
    if (Number.isNaN(sinceDate)) {
      throw new InvalidOptionError(
        `Invalid --since date: "${since}". Use ISO 8601 format (e.g. 2026-03-01).`,
      );
    }
  }

  // 1. Validate prerequisites
  // Resolved in-process rather than by spawning `which`: `which` is itself a bare name resolved
  // against PATH, absent from minimal container images, and outside /usr/bin on NixOS.
  if (resolveExecutable("granola") === null) {
    throw new GranolaNotInstalledError();
  }
  log(json, "Checking granola-cli authentication...");
  await ensureAuth();

  // 2. Ensure output directory exists and is writable
  if (!dryRun) {
    if (!existsSync(outputDir)) {
      // 0o700, not the default 0o755: the files inside are 0o600, but the *filenames* carry
      // every meeting's title and date, and a world-readable directory hands those out.
      mkdirSync(outputDir, { recursive: true, mode: 0o700 });
    }
    try {
      accessSync(outputDir, constants.W_OK);
    } catch {
      throw new Error(`Output directory not writable: ${outputDir}`);
    }
  }

  // 3. List meetings (rich data: title, date, people, calendar, notes)
  log(json, "Fetching meeting list...");
  let meetings = await listMeetings();

  // Filter out deleted meetings
  meetings = meetings.filter((m) => !m.deleted_at);

  if (notePrefix !== undefined) {
    meetings = meetings.filter((m) => m.id === notePrefix || m.id.startsWith(notePrefix));
    if (meetings.length === 0) {
      throw new MeetingNotFoundError(notePrefix);
    }
  }

  if (sinceDate !== undefined) {
    meetings = meetings.filter((m) => new Date(m.created_at).getTime() >= sinceDate);
  }

  log(json, `Found ${meetings.length} meetings to export\n`);

  // 4. Process each meeting
  const stats = {
    total: meetings.length,
    exported: 0,
    withSummary: 0,
    withTranscript: 0,
    withNotes: 0,
    noSpeech: 0,
    errors: 0,
  };
  const files: string[] = [];

  for (let i = 0; i < meetings.length; i++) {
    const meeting = meetings[i];
    const label = stripControlChars(meeting.title || "Untitled");
    const progress = `[${i + 1}/${meetings.length}]`;

    try {
      // 4a. Fetch transcript (separate call - not in list data)
      const transcript = meeting.transcribe !== false ? await getTranscript(meeting.id) : [];

      // 4b. Get enhanced AI summary (separate call)
      const enhanced = await getEnhanced(meeting.id);

      // 4c. Determine content flags
      const flags: string[] = [];
      const hasTranscript = transcript.length > 0;
      const hasNotes = !!meeting.notes_plain?.trim();
      const hasSummary = enhanced !== null;

      if (hasTranscript) {
        flags.push("transcript");
        stats.withTranscript++;
      }
      if (hasSummary) {
        flags.push("summary");
        stats.withSummary++;
      }
      if (hasNotes) {
        flags.push("notes");
        stats.withNotes++;
      }
      if (!hasTranscript && !hasSummary && !hasNotes) {
        flags.push("no-speech");
        stats.noSpeech++;
      }

      // 4d. LLM extraction (if summary available)
      let insights = null;
      if (hasSummary && !skipLlm) {
        const summaryText = toMarkdown(enhanced);
        if (summaryText) {
          if (verbose) log(json, `  Extracting insights for "${label}"...`);
          insights = await extractInsights(summaryText, label);
        }
      }

      // 4e. Convert to Minutes format
      const converted = convertMeeting(meeting, transcript, enhanced, insights);

      // 4f. Write file
      const written = writeMinutesFile(
        outputDir,
        converted.slug,
        converted.frontmatter,
        converted.body,
        dryRun,
      );

      stats.exported++;
      files.push(join(outputDir, written));
      const flagStr = flags.length > 0 ? ` (${flags.join(", ")})` : "";
      log(json, `${progress} ${label}${flagStr} -> ${written}`);
    } catch (err) {
      stats.errors++;
      // errorMessage carries child stderr verbatim (extractor.ts, granola.ts), so it is just as
      // attacker-influenced as the label beside it.
      console.error(`${progress} ERROR ${label}: ${stripControlChars(errorMessage(err))}`);
    }
  }

  // 5. Report
  log(json, "\n--- Export complete ---");
  log(
    json,
    `${stats.exported} exported | ` +
      `${stats.withSummary} summary | ` +
      `${stats.withTranscript} transcript | ` +
      `${stats.withNotes} notes | ` +
      `${stats.noSpeech} no-speech | ` +
      `${stats.errors} errors`,
  );

  // 6. Note about cache-only meetings not exported
  if (notePrefix === undefined) {
    log(json, "\nNote: Meetings older than ~30 days may have expired from Granola servers.");
    log(
      json,
      "Check local cache at ~/Library/Application Support/Granola/cache-v6.json for historical IDs.",
    );
  }

  // 7. JSON output for machine consumption
  if (json) {
    const result = {
      output_dir: outputDir,
      dry_run: dryRun,
      meetings_found: stats.total,
      exported: stats.exported,
      with_summary: stats.withSummary,
      with_transcript: stats.withTranscript,
      with_notes: stats.withNotes,
      no_speech: stats.noSpeech,
      errors: stats.errors,
      files,
    };
    console.log(JSON.stringify(result, null, 2));
  }
}
