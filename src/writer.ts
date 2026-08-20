import { randomBytes } from "node:crypto";
import { existsSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import matter from "gray-matter";
import { COLLISION } from "./config.js";
import type { MinutesFrontmatter } from "./types.js";
import { stripControlChars } from "./utils.js";

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

  // The slug must land as a direct child of outputDir. `buildSlug` sanitizes the title
  // exhaustively, but splices the date half in raw — this is the backstop that turns any future
  // slug defect into a thrown error instead of a file written somewhere it was never meant to go.
  if (dirname(resolve(filePath)) !== resolve(outputDir)) {
    throw new Error(`Refusing to write outside the output directory: ${resolvedSlug}`);
  }

  const cleanFm = cleanFrontmatter(frontmatter);

  // gray-matter parses its own body argument, so a body opening with `---` would be handed to
  // js-yaml's load() — the one path in this tool that reaches the YAML parser CVEs. `buildBody`
  // always opens with `##` or is empty, but that invariant lives in another module; keep it
  // enforced here, where the parser actually is.
  const safeBody = body.startsWith("---") ? `\n${body}` : body;

  // lineWidth: -1 disables js-yaml line folding. Without it, any frontmatter scalar over 78
  // characters is emitted as a folded block scalar whose continuation lines sit at column 2 — and
  // Minutes' `extract_field` is a line scanner, not a YAML parser, so it returns the first trimmed
  // line starting with the key. A crafted long title places `date: 2099-12-31...` on a fold line
  // and forges the field. The cast is required for `pnpm build`: gray-matter's GrayMatterOption
  // type does not declare js-yaml's dump options, although it forwards them at runtime.
  //
  // This is only half the control. Folding is what js-yaml does on its own; a value that already
  // CONTAINS a newline is emitted as a `|-` block with the same column-2 continuation lines no
  // matter what lineWidth says. `cleanFrontmatter` above is what closes that half.
  const content = matter.stringify(safeBody, cleanFm, {
    lineWidth: -1,
  } as unknown as Parameters<typeof matter.stringify>[2]);

  if (dryRun) {
    console.error(`  [dry-run] Would write: ${resolvedSlug}`);
    return resolvedSlug;
  }

  // Randomized name + "wx" (exclusive create): a predictable `<slug>.md.tmp` could be pre-created
  // as a symlink, and the previous flags would have followed it and re-used its mode.
  const tmpPath = `${filePath}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    writeFileSync(tmpPath, content, { encoding: "utf-8", mode: 0o600, flag: "wx" });
    renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // tmp file already gone or never created
    }
    throw err;
  }
  return resolvedSlug;
}

function resolveCollision(dir: string, slug: string): string {
  if (!existsSync(join(dir, slug))) return slug;

  const base = slug.replace(/\.md$/, "");
  for (let i = 2; i <= COLLISION.maxAttempts; i++) {
    const candidate = `${base}-${i}.md`;
    if (!existsSync(join(dir, candidate))) return candidate;
  }
  // Exhausting the range used to fall through to the un-suffixed slug, which then overwrote the
  // meeting already exported under that name. Losing one meeting to an error beats losing a
  // different one silently.
  throw new Error(
    `No free filename for ${slug} after ${COLLISION.maxAttempts} attempts; ` +
      "remove or rename the existing files and re-run.",
  );
}

/**
 * Drop empty values, and launder every string the frontmatter carries.
 *
 * The laundering is a security control, not tidying. `lineWidth: -1` stops js-yaml *folding* a
 * long scalar, but a value that already contains a newline is still emitted as a `|-` block whose
 * continuation lines sit at column 2 — so a meeting titled
 *
 *     Weekly sync\ndate: 2099-12-31T00:00:00+08:00\nstatus: done
 *
 * hands Minutes' line-scanning `extract_field` a forged `date` AND `status`, exactly as the folded
 * case did. Every field an attacker can influence — title from the calendar invite, calendar_event,
 * attendee names — reaches YAML through here, so this is the one place that covers them all,
 * including fields added later.
 */
function cleanFrontmatter(fm: MinutesFrontmatter): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = launder(value);
  }
  return result;
}

function launder(value: unknown): unknown {
  if (typeof value === "string") return stripControlChars(value);
  if (Array.isArray(value)) return value.map(launder);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      // Assigning a "__proto__" key with bracket notation would set the prototype, not a property.
      if (key === "__proto__") continue;
      out[key] = launder(nested);
    }
    return out;
  }
  return value;
}
