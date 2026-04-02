import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  GranolaMeeting,
  GranolaUtterance,
  ProseMirrorDoc,
} from './types.js';

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 30_000;
const DELAY_MS = 500;
const MAX_BUFFER = 50 * 1024 * 1024;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureAuth(): Promise<void> {
  try {
    await execFileAsync('granola', ['auth', 'status'], { timeout: TIMEOUT_MS });
  } catch (err: unknown) {
    const exitCode = (err as { code?: number }).code;
    if (exitCode === 2 || (err as Error).message?.includes('Not authenticated')) {
      console.error('Granola CLI is not authenticated.');
      console.error('Run: granola auth login');
      process.exit(2);
    }
    throw err;
  }
}

export async function listMeetings(
  limit: number = 1000,
): Promise<GranolaMeeting[]> {
  const { stdout } = await execFileAsync(
    'granola',
    ['meeting', 'list', '--limit', String(limit), '-o', 'json'],
    { timeout: TIMEOUT_MS * 3, maxBuffer: MAX_BUFFER },
  );
  return JSON.parse(stdout) as GranolaMeeting[];
}

export async function getTranscript(
  id: string,
): Promise<GranolaUtterance[]> {
  await sleep(DELAY_MS);
  try {
    const { stdout } = await execFileAsync(
      'granola',
      ['meeting', 'transcript', id, '-o', 'json'],
      { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER },
    );
    return JSON.parse(stdout) as GranolaUtterance[];
  } catch (err: unknown) {
    const exitCode = (err as { code?: number }).code;
    if (exitCode === 4) return [];
    if (exitCode === 2) throw err;
    console.error(`Warning: transcript failed for ${id}: ${(err as Error).message}`);
    return [];
  }
}

export async function getEnhanced(
  id: string,
): Promise<ProseMirrorDoc | null> {
  await sleep(DELAY_MS);
  try {
    const { stdout } = await execFileAsync(
      'granola',
      ['meeting', 'enhanced', id, '-o', 'json'],
      { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER },
    );
    return JSON.parse(stdout) as ProseMirrorDoc;
  } catch (err: unknown) {
    const exitCode = (err as { code?: number }).code;
    if (exitCode === 4) return null;
    if (exitCode === 2) throw err;
    console.error(`Warning: enhanced failed for ${id}: ${(err as Error).message}`);
    return null;
  }
}
