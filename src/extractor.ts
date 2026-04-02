import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { MeetingInsights } from './types.js';

const execFileAsync = promisify(execFile);

const INSIGHTS_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    action_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          assignee: { type: 'string' },
          task: { type: 'string' },
          due: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['assignee', 'task', 'status'],
      },
    },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          topic: { type: 'string' },
        },
        required: ['text'],
      },
    },
    intents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['action-item', 'decision', 'open-question', 'commitment'],
          },
          what: { type: 'string' },
          who: { type: 'string' },
          status: { type: 'string' },
          by_date: { type: 'string' },
        },
        required: ['kind', 'what', 'status'],
      },
    },
  },
  required: ['action_items', 'decisions', 'intents'],
});

let claudeAvailable: boolean | null = null;

async function checkClaude(): Promise<boolean> {
  if (claudeAvailable !== null) return claudeAvailable;
  try {
    await execFileAsync('which', ['claude']);
    claudeAvailable = true;
  } catch {
    claudeAvailable = false;
  }
  return claudeAvailable;
}

export async function extractInsights(
  summary: string,
  title: string,
): Promise<MeetingInsights | null> {
  if (!summary.trim()) return null;

  if (!(await checkClaude())) {
    console.error('Warning: claude CLI not found, skipping LLM extraction');
    return null;
  }

  const systemPrompt =
    'Extract action items, decisions, and intents from the meeting summary provided on stdin. ' +
    'Only include items explicitly mentioned. If none found, return empty arrays.';

  const input = `Meeting: ${title}\n\nSummary:\n${summary}`;

  try {
    const stdout = await spawnClaude(input, systemPrompt);
    const result = JSON.parse(stdout);
    return (result.structured_output ?? null) as MeetingInsights | null;
  } catch (err: unknown) {
    console.error(`Warning: LLM extraction failed for "${title}": ${(err as Error).message}`);
    return null;
  }
}

function spawnClaude(input: string, systemPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', [
      '-p',
      '--output-format', 'json',
      '--json-schema', INSIGHTS_SCHEMA,
      '--model', 'haiku',
      '--append-system-prompt', systemPrompt,
    ], { timeout: 60_000 });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`claude exited with code ${code}: ${stderr.slice(0, 200)}`));
      }
    });

    proc.on('error', reject);

    proc.stdin.write(input);
    proc.stdin.end();
  });
}
