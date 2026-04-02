import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { INSIGHTS_SCHEMA, LLM } from "./config.js";
import type { MeetingInsights } from "./types.js";
import { errorMessage } from "./utils.js";

const execFileAsync = promisify(execFile);

const SCHEMA_JSON = JSON.stringify(INSIGHTS_SCHEMA);

let claudeAvailable: boolean | null = null;

async function checkClaude(): Promise<boolean> {
  if (claudeAvailable !== null) return claudeAvailable;
  try {
    await execFileAsync("which", ["claude"]);
    claudeAvailable = true;
  } catch {
    claudeAvailable = false;
  }
  return claudeAvailable;
}

/**
 * Extract action items, decisions, and intents from a meeting summary via Claude CLI.
 * @returns Structured insights, or null if extraction fails or is unavailable
 */
export async function extractInsights(
  summary: string,
  title: string,
): Promise<MeetingInsights | null> {
  if (!summary.trim()) return null;

  if (!(await checkClaude())) {
    console.error("Warning: claude CLI not found, skipping LLM extraction");
    return null;
  }

  const systemPrompt =
    "Extract action items, decisions, and intents from the meeting summary provided on stdin. " +
    "Only include items explicitly mentioned. If none found, return empty arrays. " +
    'Use status "open" for active/pending items and "done" for completed items.';

  const input = `Meeting: ${title}\n\nSummary:\n${summary}`;

  try {
    const stdout = await spawnClaude(input, systemPrompt);
    const result = JSON.parse(stdout);
    return (result.structured_output ?? null) as MeetingInsights | null;
  } catch (err: unknown) {
    console.error(`Warning: LLM extraction failed for "${title}": ${errorMessage(err)}`);
    return null;
  }
}

function spawnClaude(input: string, systemPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "claude",
      [
        "-p",
        "--output-format",
        "json",
        "--json-schema",
        SCHEMA_JSON,
        "--model",
        LLM.model,
        "--append-system-prompt",
        systemPrompt,
      ],
      { timeout: LLM.timeout },
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`claude exited with code ${code}: ${stderr.slice(0, 200)}`));
      }
    });

    proc.on("error", reject);

    proc.stdin.write(input);
    proc.stdin.end();
  });
}
