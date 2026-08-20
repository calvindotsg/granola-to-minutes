import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GranolaMeeting, GranolaUtterance, ProseMirrorDoc } from "./types.js";
import { errorMessage, GranolaAuthError, GranolaNotInstalledError } from "./utils.js";
import { resolveExecutable } from "./which.js";

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 30_000;
const DELAY_MS = 500;
const MAX_BUFFER = 50 * 1024 * 1024;
const AUTH_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // Re-import credentials every 10 min

let lastAuthRefresh = 0;

// Resolved once and reused. An export run makes 200+ granola calls; by bare name every one of them
// re-searches PATH, so the binary answering call 200 need not be the one that answered call 1.
// Resolved lazily rather than at import so a missing granola surfaces as GranolaNotInstalledError
// out of ensureAuth() -- the first call runExport makes -- rather than crashing at module load.
let granolaPath: string | null = null;

function granolaBin(): string {
  if (granolaPath === null) {
    granolaPath = resolveExecutable("granola");
    if (granolaPath === null) throw new GranolaNotInstalledError();
  }
  return granolaPath;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Verify granola-cli is authenticated. Throws GranolaAuthError on failure. */
export async function ensureAuth(): Promise<void> {
  try {
    await execFileAsync(granolaBin(), ["auth", "status"], { timeout: TIMEOUT_MS });
    lastAuthRefresh = Date.now();
  } catch (err: unknown) {
    const exitCode = (err as { code?: number }).code;
    if (exitCode === 2 || errorMessage(err).includes("Not authenticated")) {
      throw new GranolaAuthError();
    }
    throw err;
  }
}

async function refreshAuthIfNeeded(): Promise<void> {
  if (Date.now() - lastAuthRefresh < AUTH_REFRESH_INTERVAL_MS) return;
  try {
    await execFileAsync(granolaBin(), ["auth", "login"], { timeout: TIMEOUT_MS });
    lastAuthRefresh = Date.now();
    console.error("  (auth refreshed)");
  } catch (err: unknown) {
    console.error(`  (auth refresh failed: ${errorMessage(err)})`);
  }
}

async function retryOnAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const msg = errorMessage(err);
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("Authentication")) {
      console.error("  (401 detected, re-importing credentials...)");
      try {
        await execFileAsync(granolaBin(), ["auth", "login"], { timeout: TIMEOUT_MS });
        lastAuthRefresh = Date.now();
      } catch {
        throw err;
      }
      return await fn();
    }
    throw err;
  }
}

/** Fetch all meetings via `granola meeting list`. Returns rich metadata. */
export async function listMeetings(limit: number = 1000): Promise<GranolaMeeting[]> {
  const { stdout } = await execFileAsync(
    granolaBin(),
    ["meeting", "list", "--limit", String(limit), "-o", "json"],
    { timeout: TIMEOUT_MS * 3, maxBuffer: MAX_BUFFER },
  );
  try {
    return JSON.parse(stdout) as GranolaMeeting[];
  } catch {
    throw new Error(`Failed to parse granola meeting list output (${stdout.length} bytes)`);
  }
}

/** Fetch transcript utterances for a meeting. Returns empty array if unavailable. */
export async function getTranscript(id: string): Promise<GranolaUtterance[]> {
  await sleep(DELAY_MS);
  await refreshAuthIfNeeded();
  try {
    return await retryOnAuth(async () => {
      const { stdout } = await execFileAsync(
        granolaBin(),
        ["meeting", "transcript", id, "-o", "json"],
        { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      );
      try {
        return JSON.parse(stdout) as GranolaUtterance[];
      } catch {
        throw new Error(`Failed to parse granola transcript output for ${id}`);
      }
    });
  } catch (err: unknown) {
    const exitCode = (err as { code?: number }).code;
    if (exitCode === 4) return [];
    if (exitCode === 2) throw err;
    console.error(`Warning: transcript failed for ${id}: ${errorMessage(err)}`);
    return [];
  }
}

/** Fetch AI-enhanced summary for a meeting. Returns null if unavailable. */
export async function getEnhanced(id: string): Promise<ProseMirrorDoc | null> {
  await sleep(DELAY_MS);
  await refreshAuthIfNeeded();
  try {
    return await retryOnAuth(async () => {
      const { stdout } = await execFileAsync(
        granolaBin(),
        ["meeting", "enhanced", id, "-o", "json"],
        {
          timeout: TIMEOUT_MS,
          maxBuffer: MAX_BUFFER,
        },
      );
      try {
        return JSON.parse(stdout) as ProseMirrorDoc;
      } catch {
        throw new Error(`Failed to parse granola enhanced output for ${id}`);
      }
    });
  } catch (err: unknown) {
    const exitCode = (err as { code?: number }).code;
    if (exitCode === 4) return null;
    if (exitCode === 2) throw err;
    console.error(`Warning: enhanced failed for ${id}: ${errorMessage(err)}`);
    return null;
  }
}
