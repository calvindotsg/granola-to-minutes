import { type MockedFunction, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock child_process before importing extractor
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

import { execFile, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { Writable } from "node:stream";

const mockExecFile = execFile as MockedFunction<typeof execFile>;
const mockSpawn = spawn as MockedFunction<typeof spawn>;

// We need to re-import extractor for each test to reset module-level state
async function importExtractor() {
  const mod = await import("../../src/extractor.js");
  return mod.extractInsights;
}

function createMockProcess(
  stdoutData: string,
  exitCode: number,
  stderrData = "",
): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const stdin = { write: vi.fn(), end: vi.fn() } as unknown as Writable;

  (proc as any).stdout = stdout;
  (proc as any).stderr = stderr;
  (proc as any).stdin = stdin;

  // Emit data and close asynchronously
  setTimeout(() => {
    if (stdoutData) stdout.emit("data", Buffer.from(stdoutData));
    if (stderrData) stderr.emit("data", Buffer.from(stderrData));
    proc.emit("close", exitCode);
  }, 0);

  return proc;
}

describe("extractInsights", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns null for empty summary", async () => {
    const extractInsights = await importExtractor();
    const result = await extractInsights("", "Test");
    expect(result).toBeNull();
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("returns null when claude CLI is not available", async () => {
    // Make 'which claude' fail
    mockExecFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(new Error("not found"));
      return {} as any;
    });

    const extractInsights = await importExtractor();
    const result = await extractInsights("Meeting summary content", "Test Meeting");
    expect(result).toBeNull();
  });

  it("returns parsed insights on successful extraction", async () => {
    // Make 'which claude' succeed
    mockExecFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(null, { stdout: "/usr/bin/claude", stderr: "" });
      return {} as any;
    });

    const mockOutput = JSON.stringify({
      structured_output: {
        action_items: [{ assignee: "Alice", task: "Do thing", status: "open" }],
        decisions: [],
        intents: [],
      },
    });

    mockSpawn.mockReturnValue(createMockProcess(mockOutput, 0));

    const extractInsights = await importExtractor();
    const result = await extractInsights("Meeting summary content", "Test Meeting");

    expect(result).not.toBeNull();
    expect(result!.action_items).toHaveLength(1);
    expect(result!.action_items[0].assignee).toBe("Alice");
  });

  it("returns null when claude exits non-zero", async () => {
    mockExecFile.mockImplementation((_cmd, _args, callback: any) => {
      callback(null, { stdout: "/usr/bin/claude", stderr: "" });
      return {} as any;
    });

    mockSpawn.mockReturnValue(createMockProcess("", 1, "Error occurred"));

    const extractInsights = await importExtractor();
    const result = await extractInsights("Meeting summary content", "Test Meeting");
    expect(result).toBeNull();
  });
});
