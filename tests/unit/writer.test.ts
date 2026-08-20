import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MinutesFrontmatter } from "../../src/types.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import { existsSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { COLLISION } from "../../src/config.js";
import { writeMinutesFile } from "../../src/writer.js";

/** The tmp path carries a random suffix, so tests match its shape rather than a literal. */
const tmpPathFor = (target: string) => new RegExp(`^${target}\\.[0-9a-f]{16}\\.tmp$`);

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
    const tmpPath = String(mockWriteFileSync.mock.calls[0][0]);
    expect(tmpPath).toMatch(tmpPathFor("/out/test.md"));
    expect(mockRenameSync).toHaveBeenCalledWith(tmpPath, "/out/test.md");
  });

  it("creates the tmp file exclusively, so it cannot follow a planted symlink", () => {
    mockExistsSync.mockReturnValue(false);

    writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false);

    expect(mockWriteFileSync.mock.calls[0][2]).toMatchObject({ flag: "wx" });
  });

  it("uses a fresh tmp name each write, so the path is unguessable", () => {
    mockExistsSync.mockReturnValue(false);

    writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false);
    writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false);

    expect(mockWriteFileSync.mock.calls[0][0]).not.toBe(mockWriteFileSync.mock.calls[1][0]);
  });

  it("writes files with owner-only permissions (0o600)", () => {
    mockExistsSync.mockReturnValue(false);

    writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false);

    expect(mockWriteFileSync.mock.calls[0][2]).toEqual({
      encoding: "utf-8",
      mode: 0o600,
      flag: "wx",
    });
  });

  it("cleans up tmp file when rename fails", () => {
    mockExistsSync.mockReturnValue(false);
    mockRenameSync.mockImplementation(() => {
      throw new Error("rename failed");
    });

    expect(() => writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false)).toThrow(
      "rename failed",
    );

    expect(mockUnlinkSync).toHaveBeenCalledWith(String(mockWriteFileSync.mock.calls[0][0]));
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

  describe("containment", () => {
    it("refuses a slug that resolves outside the output directory", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() =>
        writeMinutesFile("/out", "../../etc/passwd.md", baseFrontmatter, "body", false),
      ).toThrow(/Refusing to write outside the output directory/);

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("refuses a slug that walks into a subdirectory", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() =>
        writeMinutesFile("/out", "nested/deep.md", baseFrontmatter, "body", false),
      ).toThrow(/Refusing to write outside the output directory/);
    });

    it("accepts a plain slug in a relative output directory", () => {
      mockExistsSync.mockReturnValue(false);

      expect(writeMinutesFile("out", "test.md", baseFrontmatter, "body", false)).toBe("test.md");
    });

    it("checks containment before the dry-run short circuit", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => writeMinutesFile("/out", "../escape.md", baseFrontmatter, "body", true)).toThrow(
        /Refusing to write outside the output directory/,
      );
    });
  });

  describe("collision exhaustion", () => {
    it("throws rather than overwriting once every suffix is taken", () => {
      // Previously this fell through to the un-suffixed slug and overwrote the meeting already
      // exported under that name. Failing one meeting beats silently replacing another.
      mockExistsSync.mockReturnValue(true);

      expect(() => writeMinutesFile("/out", "test.md", baseFrontmatter, "body", false)).toThrow(
        new RegExp(`No free filename for test.md after ${COLLISION.maxAttempts} attempts`),
      );
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe("YAML emission", () => {
    /** The frontmatter block as written, minus the delimiters. */
    function frontmatterBlock(fm = baseFrontmatter, body = "## Body") {
      mockExistsSync.mockReturnValue(false);
      writeMinutesFile("/out", "test.md", fm, body, false);
      const raw = String(mockWriteFileSync.mock.calls[0][1]);
      return raw.split("\n---")[0].replace(/^---\n/, "");
    }

    it("never folds a long scalar onto continuation lines", () => {
      // js-yaml folds any scalar over 78 chars into a `>-` block whose continuation lines sit at
      // column 2. Minutes' extract_field is a line scanner, so a fold line reading `date: ...`
      // would be returned in place of the real date field.
      const title = `Partner sync review ${"x".repeat(53)} date: 2099-12-31T00:00:00+08:00 next`;
      const block = frontmatterBlock({ ...baseFrontmatter, title });

      expect(block).not.toContain(">-");
      const afterTitle = block
        .split("\n")
        .slice(1)
        .filter((line) => /^(title|type|date|duration|source|status):/.test(line.trim()));
      expect(afterTitle).toEqual([
        "type: meeting",
        "date: '2026-03-17T14:30:00+08:00'",
        "duration: 30m",
        "source: granola-reimport",
        "status: complete",
      ]);
    });

    it("laundries control characters out of every frontmatter string", () => {
      mockExistsSync.mockReturnValue(false);
      const block = frontmatterBlock({
        ...baseFrontmatter,
        title: "Weekly sync\ndate: 2099-12-31T00:00:00+08:00",
        attendees: ["Alice\nstatus: done"],
        action_items: [{ assignee: "Bob\nx", task: "Ship\nit", status: "open" }],
      });

      // No block scalar means no column-2 continuation lines for the consumer's line reader.
      expect(block).not.toContain("|-");
      expect(block).not.toContain(">-");
      // extract_field takes the FIRST trimmed line starting with the key, so that is the property
      // to assert. `status:` legitimately recurs inside action_items; what must never happen is a
      // laundered-away line jumping ahead of the real one.
      const firstLineFor = (key: string) =>
        block
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.startsWith(`${key}:`));

      expect(firstLineFor("date")).toBe("date: '2026-03-17T14:30:00+08:00'");
      expect(firstLineFor("status")).toBe("status: complete");
      expect(firstLineFor("duration")).toBe("duration: 30m");
      expect(firstLineFor("source")).toBe("source: granola-reimport");
    });

    it("passes non-string scalars through untouched", () => {
      mockExistsSync.mockReturnValue(false);
      // Nothing in MinutesFrontmatter is numeric today, but launder() must not mangle one if a
      // future field is.
      const block = frontmatterBlock({ ...baseFrontmatter, duration: 30 as unknown as string });

      expect(block).toContain("duration: 30");
    });

    it("does not let a __proto__ key from nested data touch the prototype", () => {
      mockExistsSync.mockReturnValue(false);
      const hostile = JSON.parse(
        '{"assignee":"A","task":"T","status":"open","__proto__":{"pwned":1}}',
      );

      writeMinutesFile(
        "/out",
        "test.md",
        { ...baseFrontmatter, action_items: [hostile] },
        "b",
        false,
      );

      expect(({} as Record<string, unknown>).pwned).toBeUndefined();
    });

    it("keeps a body that opens with --- away from gray-matter's own parser", () => {
      mockExistsSync.mockReturnValue(false);
      writeMinutesFile("/out", "test.md", baseFrontmatter, "---\nnot: frontmatter", false);

      const raw = String(mockWriteFileSync.mock.calls[0][1]);
      expect(raw).toContain("title: Test Meeting");
      expect(raw).toContain("not: frontmatter");
    });
  });
});
