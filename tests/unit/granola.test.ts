import { beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";

// Mock child_process before importing granola
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("../../src/which.js", () => ({
  resolveExecutable: vi.fn(),
}));

import { execFile } from "node:child_process";
import { resolveExecutable } from "../../src/which.js";

const mockExecFile = execFile as MockedFunction<typeof execFile>;
const mockResolve = vi.mocked(resolveExecutable);

const GRANOLA = "/opt/homebrew/bin/granola";

/**
 * `granola.ts` is excluded from coverage and had no tests at all, which is exactly why the binary
 * it spawns is worth pinning down here: an export run makes 200+ of these calls, and the argv[0]
 * they use is the difference between "the binary we checked" and "whatever PATH answers next".
 */
async function importGranola() {
  return import("../../src/granola.js");
}

/** Resolve every execFile call successfully with the given stdout. */
function granolaReplies(stdout = "[]") {
  mockExecFile.mockImplementation((_cmd, _args, _opts, callback: any) => {
    // promisify() calls execFile with (cmd, args, options, callback) here.
    const cb = typeof _opts === "function" ? _opts : callback;
    cb(null, { stdout, stderr: "" });
    return {} as any;
  });
}

/** Every command the module runs, as [binary, args] pairs. */
function spawnedCommands(): Array<[string, string[]]> {
  return mockExecFile.mock.calls.map((call) => [call[0] as string, call[1] as string[]]);
}

describe("granola-cli invocation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockResolve.mockReturnValue(GRANOLA);
    granolaReplies();
  });

  it("spawns the resolved absolute path, never the bare name", async () => {
    const { ensureAuth } = await importGranola();
    await ensureAuth();

    expect(spawnedCommands()[0][0]).toBe(GRANOLA);
    expect(spawnedCommands()[0][1]).toEqual(["auth", "status"]);
  });

  it("resolves once and reuses it across every call", async () => {
    const granola = await importGranola();
    await granola.ensureAuth();
    await granola.listMeetings();
    await granola.getTranscript("meeting-1");

    // The point of the change: 200+ calls must not mean 200+ PATH searches.
    expect(mockResolve).toHaveBeenCalledTimes(1);
    for (const [binary] of spawnedCommands()) {
      expect(binary).toBe(GRANOLA);
    }
  });

  it("throws GranolaNotInstalledError when granola is not on PATH", async () => {
    mockResolve.mockReturnValue(null);
    const { ensureAuth } = await importGranola();

    // Surfaces from the first call runExport makes, rather than as a spawn ENOENT 200 calls deep.
    await expect(ensureAuth()).rejects.toThrow(/granola-cli is not installed/);
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("maps a non-authenticated exit to GranolaAuthError", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback: any) => {
      const cb = typeof _opts === "function" ? _opts : callback;
      cb(Object.assign(new Error("Not authenticated"), { code: 2 }));
      return {} as any;
    });
    const { ensureAuth } = await importGranola();

    await expect(ensureAuth()).rejects.toThrow(/not authenticated/i);
  });

  it("rethrows an unrelated failure rather than calling it an auth problem", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback: any) => {
      const cb = typeof _opts === "function" ? _opts : callback;
      cb(new Error("ENOSPC: no space left on device"));
      return {} as any;
    });
    const { ensureAuth } = await importGranola();

    await expect(ensureAuth()).rejects.toThrow(/ENOSPC/);
  });

  it("parses the meeting list from stdout", async () => {
    granolaReplies(JSON.stringify([{ id: "m1", title: "Weekly Sync" }]));
    const { listMeetings } = await importGranola();

    const meetings = await listMeetings();
    expect(meetings).toHaveLength(1);
    expect(meetings[0].id).toBe("m1");
  });
});
