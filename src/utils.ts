/**
 * Safely extract a message from an unknown error value.
 * Handles non-Error throws (strings, objects with code property, etc.)
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Remove C0/C1 control characters from third-party text.
 *
 * Meeting titles and LLM output are attacker-influenceable: a calendar invite names the meeting,
 * and Granola passes that string through verbatim. Unfiltered, those bytes repaint the operator's
 * terminal on the way to stderr (ANSI/OSC — including OSC 52, which reaches the clipboard) and
 * carry raw control characters into frontmatter values.
 */
export function stripControlChars(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the entire point
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
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
