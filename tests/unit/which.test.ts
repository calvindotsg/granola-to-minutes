import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveExecutable } from "../../src/which.js";

describe("resolveExecutable", () => {
  let dir: string;
  const realPath = process.env.PATH;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gtm-resolve-"));
    process.env.PATH = dir;
  });

  afterEach(() => {
    process.env.PATH = realPath;
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the absolute path of an executable on PATH", () => {
    writeFileSync(join(dir, "tool"), "#!/bin/sh\n", { mode: 0o755 });
    expect(resolveExecutable("tool")).toBe(join(dir, "tool"));
  });

  it("returns null when the name is not on PATH", () => {
    expect(resolveExecutable("tool")).toBeNull();
  });

  it("skips a file that is present but not executable", () => {
    writeFileSync(join(dir, "tool"), "not a program\n", { mode: 0o644 });
    expect(resolveExecutable("tool")).toBeNull();
  });

  it("skips a directory that happens to share the name", () => {
    mkdirSync(join(dir, "tool"));
    expect(resolveExecutable("tool")).toBeNull();
  });

  it("ignores relative PATH entries, which would resolve out of the cwd", () => {
    // execvp honours these; we deliberately do not. Half the point of resolving up front is that
    // the working directory is not a place to accept a binary from.
    process.env.PATH = `.${delimiter}${dir}`;
    writeFileSync(join(dir, "tool"), "#!/bin/sh\n", { mode: 0o755 });
    expect(resolveExecutable("tool")).toBe(join(dir, "tool"));
  });

  it("ignores empty PATH entries", () => {
    process.env.PATH = `${delimiter}${dir}`;
    writeFileSync(join(dir, "tool"), "#!/bin/sh\n", { mode: 0o755 });
    expect(resolveExecutable("tool")).toBe(join(dir, "tool"));
  });

  it("returns the first match when several PATH entries provide the name", () => {
    const second = mkdtempSync(join(tmpdir(), "gtm-resolve-2-"));
    try {
      writeFileSync(join(dir, "tool"), "#!/bin/sh\n", { mode: 0o755 });
      writeFileSync(join(second, "tool"), "#!/bin/sh\n", { mode: 0o755 });
      process.env.PATH = `${dir}${delimiter}${second}`;
      expect(resolveExecutable("tool")).toBe(join(dir, "tool"));
    } finally {
      rmSync(second, { recursive: true, force: true });
    }
  });

  it("treats a name containing a separator as a path, not a PATH lookup", () => {
    expect(resolveExecutable("/bin/sh")).toBe("/bin/sh");
    // Exists, but is not executable — a path is still checked, just not searched for.
    expect(resolveExecutable("/etc/hosts")).toBeNull();
  });

  it("returns null when PATH is unset entirely", () => {
    process.env.PATH = undefined;
    expect(resolveExecutable("tool")).toBeNull();
  });
});
