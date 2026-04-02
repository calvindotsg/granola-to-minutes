import { existsSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { COLLISION } from "./config.js";
import type { MinutesFrontmatter } from "./types.js";

/** Write a Minutes markdown file with YAML frontmatter. Handles filename collisions atomically. */
export function writeMinutesFile(
  outputDir: string,
  slug: string,
  frontmatter: MinutesFrontmatter,
  body: string,
  dryRun: boolean,
): string {
  const resolvedSlug = resolveCollision(outputDir, slug);
  const filePath = join(outputDir, resolvedSlug);

  const cleanFm = stripEmpty(frontmatter);
  const content = matter.stringify(body, cleanFm);

  if (dryRun) {
    console.error(`  [dry-run] Would write: ${resolvedSlug}`);
    return resolvedSlug;
  }

  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, filePath);
  return resolvedSlug;
}

function resolveCollision(dir: string, slug: string): string {
  if (!existsSync(join(dir, slug))) return slug;

  const base = slug.replace(/\.md$/, "");
  for (let i = 2; i <= COLLISION.maxAttempts; i++) {
    const candidate = `${base}-${i}.md`;
    if (!existsSync(join(dir, candidate))) return candidate;
  }
  return slug;
}

function stripEmpty(fm: MinutesFrontmatter): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  return result;
}
