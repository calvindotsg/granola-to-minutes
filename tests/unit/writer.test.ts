import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MinutesFrontmatter } from "../../src/types.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import { existsSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { writeMinutesFile } from "../../src/writer.js";

const mockExistsSync = vi.mocked(existsSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockRenameSync = vi.mocked(renameSync);
const mockUnlinkSync = vi.mocked(unlinkSync);

const baseFrontmatter: MinutesFrontmatter = {
  title: "Test Meeting",
  type: "meeting",
  date: "2026-03-17T14:30:00+08:00",
  duration: "30m",
  source: "granola-reimport",
  status: "complete",
};

describe("writeMinutesFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("writes tmp file then renames atomically", () => {
    mockExistsSync.mockReturnValue(false);

    writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    expect(mockWriteFileSync.mock.calls[0][0]).toBe("/out/test.md.tmp");
    expect(mockRenameSync).toHaveBeenCalledWith("/out/test.md.tmp", "/out/test.md");
  });

  it("writes files with owner-only permissions (0o600)", () => {
    mockExistsSync.mockReturnValue(false);

    writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false);

    expect(mockWriteFileSync.mock.calls[0][2]).toEqual({ encoding: "utf-8", mode: 0o600 });
  });

  it("cleans up tmp file when rename fails", () => {
    mockExistsSync.mockReturnValue(false);
    mockRenameSync.mockImplementation(() => {
      throw new Error("rename failed");
    });

    expect(() => writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false)).toThrow(
      "rename failed",
    );

    expect(mockUnlinkSync).toHaveBeenCalledWith("/out/test.md.tmp");
  });

  it("still throws original error if tmp cleanup also fails", () => {
    mockExistsSync.mockReturnValue(false);
    mockRenameSync.mockImplementation(() => {
      throw new Error("rename failed");
    });
    mockUnlinkSync.mockImplementation(() => {
      throw new Error("unlink failed");
    });

    expect(() => writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false)).toThrow(
      "rename failed",
    );
  });

  it("returns the slug", () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false);
    expect(result).toBe("test.md");
  });

  it("does not write in dry run mode", () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeMinutesFile("/out", "test.md", baseFrontmatter, "body", true);

    expect(result).toBe("test.md");
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockRenameSync).not.toHaveBeenCalled();
  });

  it("appends -2 suffix on collision", () => {
    mockExistsSync.mockImplementation((p) => {
      return String(p) === "/out/test.md";
    });

    const result = writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false);
    expect(result).toBe("test-2.md");
  });

  it("finds next available suffix on multiple collisions", () => {
    mockExistsSync.mockImplementation((p) => {
      const path = String(p);
      return path === "/out/test.md" || path === "/out/test-2.md" || path === "/out/test-3.md";
    });

    const result = writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false);
    expect(result).toBe("test-4.md");
  });

  it("strips undefined, null, and empty arrays from frontmatter", () => {
    mockExistsSync.mockReturnValue(false);

    const fm: MinutesFrontmatter = {
      ...baseFrontmatter,
      attendees: [],
      people: undefined as any,
      speaker_map: [],
      action_items: [],
    };

    writeMinutesFile("/out", "test.md", fm, "body", false);

    const written = String(mockWriteFileSync.mock.calls[0][1]);
    expect(written).not.toContain("attendees:");
    expect(written).not.toContain("people:");
    expect(written).not.toContain("speaker_map:");
    expect(written).not.toContain("action_items:");
    // Required fields are present
    expect(written).toContain("title: Test Meeting");
    expect(written).toContain("type: meeting");
  });
});
