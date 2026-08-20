import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all external dependencies before importing export
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  accessSync: vi.fn(),
  constants: { W_OK: 2 },
}));

vi.mock("../../src/granola.js", () => ({
  ensureAuth: vi.fn(),
  listMeetings: vi.fn(() => []),
  getTranscript: vi.fn(() => []),
  getEnhanced: vi.fn(() => null),
}));

vi.mock("../../src/extractor.js", () => ({
  extractInsights: vi.fn(() => null),
}));

vi.mock("../../src/writer.js", () => ({
  writeMinutesFile: vi.fn(() => "test.md"),
}));

import { runExport } from "../../src/export.js";
import { listMeetings } from "../../src/granola.js";
import type { ExportOptions } from "../../src/types.js";
import { makeMeeting } from "../fixtures.js";

const mockListMeetings = vi.mocked(listMeetings);

function makeOptions(overrides?: Partial<ExportOptions>): ExportOptions {
  return {
    outputDir: "/tmp/test-output",
    dryRun: true,
    skipLlm: true,
    verbose: false,
    json: false,
    ...overrides,
  };
}

describe("runExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMeetings.mockResolvedValue([]);
  });

  describe("--since validation", () => {
    it("throws on invalid date string", async () => {
      await expect(runExport(makeOptions({ since: "not-a-date" }))).rejects.toThrow(
        'Invalid --since date: "not-a-date"',
      );
    });

    it("throws with format hint in error message", async () => {
      await expect(runExport(makeOptions({ since: "yesterday" }))).rejects.toThrow(
        "ISO 8601 format",
      );
    });

    it("accepts valid ISO 8601 date", async () => {
      await expect(runExport(makeOptions({ since: "2026-03-01" }))).resolves.not.toThrow();
    });
  });

  describe("--json output", () => {
    it("writes JSON to stdout with expected fields", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await runExport(makeOptions({ json: true }));

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output).toMatchObject({
        output_dir: "/tmp/test-output",
        dry_run: true,
        meetings_found: 0,
        exported: 0,
        errors: 0,
        files: [],
      });

      consoleSpy.mockRestore();
    });

    it("suppresses progress logging in json mode", async () => {
      const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await runExport(makeOptions({ json: true }));

      // console.error should not be called for progress messages
      // (only for errors, which don't occur in this test)
      expect(stderrSpy).not.toHaveBeenCalled();

      stderrSpy.mockRestore();
      stdoutSpy.mockRestore();
    });

    it("does not write JSON when json flag is false", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      await runExport(makeOptions({ json: false }));

      expect(consoleSpy).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe("--note-id validation", () => {
    it("rejects an empty --note-id instead of exporting every meeting", async () => {
      // The guard used to be `if (noteId)`, so `--note-id ""` fell straight through the filter
      // and exported the whole account -- the opposite of what the flag asks for.
      mockListMeetings.mockResolvedValue([makeMeeting(), makeMeeting({ id: "other-id" })]);

      await expect(runExport(makeOptions({ noteId: "" }))).rejects.toThrow(
        /--note-id needs at least 4 characters/,
      );
    });

    it("rejects a prefix too short to select one meeting", async () => {
      await expect(runExport(makeOptions({ noteId: "ab" }))).rejects.toThrow(
        /--note-id needs at least 4 characters/,
      );
    });

    it("accepts a usable prefix", async () => {
      mockListMeetings.mockResolvedValue([makeMeeting({ id: "test-meeting-id-001" })]);

      await expect(runExport(makeOptions({ noteId: "test-meeting" }))).resolves.not.toThrow();
    });

    it("still reports a genuinely unknown id as not found", async () => {
      mockListMeetings.mockResolvedValue([makeMeeting({ id: "test-meeting-id-001" })]);

      await expect(runExport(makeOptions({ noteId: "nope-nope" }))).rejects.toThrow(/not found/);
    });
  });

  describe("terminal safety", () => {
    it("strips control characters from a meeting title before logging it", async () => {
      const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockListMeetings.mockResolvedValue([
        makeMeeting({ title: "Quarterly\u001B]0;pwned\u0007 review" }),
      ]);

      await runExport(makeOptions());

      const logged = stderrSpy.mock.calls.map((call) => call.join(" ")).join("\n");
      expect(logged).toContain("Quarterly");
      expect(logged).not.toContain("\u001B");
      expect(logged).not.toContain("\u0007");

      stderrSpy.mockRestore();
    });
  });
});
