/**
 * Safely extract a message from an unknown error value.
 * Handles non-Error throws (strings, objects with code property, etc.)
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** granola-cli is not installed on the system */
export class GranolaNotInstalledError extends Error {
  constructor() {
    super("granola-cli is not installed. Install: pnpm add -g granola-cli");
  }
}

/** granola-cli authentication has failed */
export class GranolaAuthError extends Error {
  constructor() {
    super("Granola CLI is not authenticated. Run: granola auth login");
  }
}

/** Requested meeting was not found */
export class MeetingNotFoundError extends Error {
  constructor(noteId: string) {
    super(`Meeting ${noteId} not found`);
  }
}
