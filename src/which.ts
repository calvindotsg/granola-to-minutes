import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

/**
 * Find `name` on PATH and return its absolute path, or null if it is not there.
 *
 * This lives in its own module rather than in utils.ts on purpose: utils.ts is imported by
 * converter.ts and writer.ts, whose tests mock `node:fs` with a partial factory. Pulling fs into
 * that import graph would make those mocks responsible for exports they have no interest in.
 *
 * Node has no built-in for this, and shelling out to `which` only moves the problem — `which` is
 * itself a bare name resolved against PATH at spawn, and it is absent from minimal container images
 * and lives outside /usr/bin on NixOS. This is the lookup execvp performs, minus the extra process.
 *
 * The result is deliberately not realpath'd: package managers install CLIs as symlinks or shims,
 * so keeping the link means an upgrade mid-run still resolves where a pinned inode would not.
 */
export function resolveExecutable(name: string): string | null {
  // A name containing a separator is already a path; execvp does not consult PATH for it.
  if (name.includes("/")) return isExecutableFile(name) ? name : null;

  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    // Empty and relative PATH entries mean "resolve out of the current directory" to execvp.
    // Skipping them is half the point of resolving at all: cwd is not a place to trust a binary.
    if (!dir || !isAbsolute(dir)) continue;
    const candidate = join(dir, name);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
