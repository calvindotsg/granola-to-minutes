#!/usr/bin/env node

import { Command } from 'commander';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { convertMeeting } from './converter.js';
import { extractInsights } from './extractor.js';
import { ensureAuth, getEnhanced, getTranscript, listMeetings } from './granola.js';
import { toMarkdown } from './prosemirror.js';
import { writeMinutesFile } from './writer.js';

const program = new Command();

program
  .name('granola-to-minutes')
  .description('Export Granola meetings to Minutes-native markdown')
  .version('0.1.0');

program
  .command('export')
  .description('Export all Granola meetings to Minutes markdown files')
  .option('--output-dir <path>', 'Output directory', join(homedir(), 'meetings'))
  .option('--dry-run', 'Preview without writing files', false)
  .option('--skip-llm', 'Skip Claude extraction of action items/decisions', false)
  .option('--note-id <id>', 'Export a single meeting by UUID')
  .option('--since <date>', 'Only meetings created after this date')
  .option('--verbose', 'Detailed logging', false)
  .action(async (opts) => {
    const {
      outputDir,
      dryRun,
      skipLlm,
      noteId,
      since,
      verbose,
    } = opts as {
      outputDir: string;
      dryRun: boolean;
      skipLlm: boolean;
      noteId?: string;
      since?: string;
      verbose: boolean;
    };

    // 1. Validate prerequisites
    try {
      const { execFileSync } = await import('node:child_process');
      execFileSync('which', ['granola']);
    } catch {
      console.error('Error: granola-cli is not installed.');
      console.error('Install: pnpm add -g granola-cli');
      process.exit(1);
    }
    console.error('Checking granola-cli authentication...');
    await ensureAuth();

    // 2. Ensure output directory exists
    if (!dryRun && !existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // 3. List meetings (rich data: title, date, people, calendar, notes)
    console.error('Fetching meeting list...');
    let meetings = await listMeetings();

    // Filter out deleted meetings
    meetings = meetings.filter((m) => !m.deleted_at);

    if (noteId) {
      meetings = meetings.filter((m) => m.id === noteId || m.id.startsWith(noteId));
      if (meetings.length === 0) {
        console.error(`Meeting ${noteId} not found`);
        process.exit(4);
      }
    }

    if (since) {
      const sinceDate = new Date(since).getTime();
      meetings = meetings.filter(
        (m) => new Date(m.created_at).getTime() >= sinceDate,
      );
    }

    console.error(`Found ${meetings.length} meetings to export\n`);

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

    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      const label = meeting.title || 'Untitled';
      const progress = `[${i + 1}/${meetings.length}]`;

      try {
        // 4a. Fetch transcript (separate call - not in list data)
        const transcript = meeting.transcribe !== false
          ? await getTranscript(meeting.id)
          : [];

        // 4b. Get enhanced AI summary (separate call)
        const enhanced = await getEnhanced(meeting.id);

        // 4c. Determine content flags
        const flags: string[] = [];
        const hasTranscript = transcript.length > 0;
        const hasNotes = meeting.notes_plain?.trim() ? true : false;
        const hasSummary = enhanced !== null;

        if (hasTranscript) { flags.push('transcript'); stats.withTranscript++; }
        if (hasSummary) { flags.push('summary'); stats.withSummary++; }
        if (hasNotes) { flags.push('notes'); stats.withNotes++; }
        if (!hasTranscript && !hasSummary && !hasNotes) {
          flags.push('no-speech');
          stats.noSpeech++;
        }

        // 4d. LLM extraction (if summary available)
        let insights = null;
        if (hasSummary && !skipLlm) {
          const summaryText = toMarkdown(enhanced);
          if (summaryText) {
            if (verbose) console.error(`  Extracting insights for "${label}"...`);
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
        const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
        console.error(`${progress} ${label}${flagStr} -> ${written}`);
      } catch (err) {
        stats.errors++;
        console.error(`${progress} ERROR ${label}: ${(err as Error).message}`);
      }
    }

    // 5. Report
    console.error('\n--- Export complete ---');
    console.error(
      `${stats.exported} exported | ` +
        `${stats.withSummary} summary | ` +
        `${stats.withTranscript} transcript | ` +
        `${stats.withNotes} notes | ` +
        `${stats.noSpeech} no-speech | ` +
        `${stats.errors} errors`,
    );

    // 6. Note about cache-only meetings not exported
    if (!noteId) {
      console.error(
        '\nNote: Meetings older than ~30 days may have expired from Granola servers.',
      );
      console.error(
        'Check local cache at ~/Library/Application Support/Granola/cache-v6.json for historical IDs.',
      );
    }
  });

program.parse();
