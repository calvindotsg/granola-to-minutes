/**
 * Contract regression suite: does what this tool writes still satisfy Minutes?
 *
 * Two layers, because they fail for different reasons:
 *
 *   Layer 1 validates the `convertMeeting()` frontmatter OBJECT against the schema Minutes
 *           publishes. Catches enum changes, removed required fields, type changes.
 *   Layer 2 validates a file written by the real `writeMinutesFile()` and read back the way
 *           Minutes reads it. Catches serialization bugs that Layer 1 structurally cannot see,
 *           because Layer 1 never touches YAML.
 *
 * See PROVENANCE.md for why the vendored schema is the right contract floor, and why
 * speaker-map.overlay.json has to exist alongside it.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { JSON_SCHEMA, load } from "js-yaml";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { convertMeeting } from "../../src/converter.js";
import type { MinutesFrontmatter } from "../../src/types.js";
import { writeMinutesFile } from "../../src/writer.js";
import { makeMeeting, makeProseMirrorDoc, makeUtterance, sampleInsights } from "../fixtures.js";

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const readSchema = (name: string) => JSON.parse(readFileSync(here(name), "utf-8"));

const publishedSchema = readSchema("minutes-frontmatter.schema.json");
const overlaySchema = readSchema("speaker-map.overlay.json");

/**
 * Faithful port of `split_frontmatter` from Minutes' crates/reader/src/parse.rs.
 *
 * It takes the FIRST `\n---` at or after index 3 — so a column-0 `---` inside a frontmatter
 * value would truncate the block and silently drop everything after it. Ported verbatim rather
 * than approximated, because the whole point is to reproduce the consumer's behaviour including
 * that sharp edge.
 */
function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  if (!content.startsWith("---")) return { frontmatter: "", body: content };

  const fmEnd = content.indexOf("\n---", 3);
  if (fmEnd === -1) return { frontmatter: "", body: content };

  const afterDelimiter = fmEnd + 4;
  const newline = content.indexOf("\n", afterDelimiter);
  const bodyStart = newline === -1 ? afterDelimiter : newline + 1;

  return { frontmatter: content.slice(3, fmEnd), body: content.slice(bodyStart) };
}

/**
 * Faithful port of `extract_field` from Minutes' crates/core/src/markdown.rs.
 *
 * This is a LINE SCANNER, not a YAML parser: the first trimmed line beginning with `<key>:` wins,
 * and everything after the colon is the value. Ported for the same reason as split_frontmatter —
 * the sharp edge IS the contract. It drives the FTS date column, the dashboard, and the
 * text-import walk, so what it returns is what those surfaces believe.
 */
function extractField(frontmatter: string, key: string): string | null {
  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}:`)) {
      return trimmed
        .slice(key.length + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
  return null;
}

let validatePublished: ReturnType<Ajv2020["compile"]>;
let validateOverlay: ReturnType<Ajv2020["compile"]>;

beforeAll(() => {
  // Two compile-time traps live here, both of which surface as "the vendored schema is broken":
  //  1. ajv's default export is the Draft-07 class and throws on `$schema: .../2020-12/schema`.
  //     The 2020-12 class only ships at ajv/dist/2020.js.
  //  2. The schema carries `format: "uint64"` (on ProcessingWarning.timeout_secs), which
  //     ajv-formats does not define, and strict mode throws on unknown formats.
  // Strict mode stays ON deliberately: turning it off would also silence the checks that would
  // catch a malformed overlay.
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  ajv.addFormat("uint64", {
    type: "number",
    validate: (n: number) => Number.isInteger(n) && n >= 0,
  });

  // Named assertion, so a new upstream format fails as a test rather than as a suite-load crash.
  expect(() => ajv.compile(publishedSchema)).not.toThrow();

  validatePublished = ajv.compile(publishedSchema);
  validateOverlay = ajv.compile(overlaySchema);
});

/** Assert against both the published schema and the local overlay, with readable failures. */
function expectValidContract(frontmatter: MinutesFrontmatter | Record<string, unknown>) {
  const asJson = JSON.parse(JSON.stringify(frontmatter));

  if (!validatePublished(asJson)) {
    throw new Error(
      `frontmatter violates the published Minutes schema:\n${JSON.stringify(validatePublished.errors, null, 2)}`,
    );
  }
  if (!validateOverlay(asJson)) {
    throw new Error(
      `frontmatter violates the speaker_map overlay:\n${JSON.stringify(validateOverlay.errors, null, 2)}`,
    );
  }
}

const transcript = [
  makeUtterance({
    source: "microphone",
    text: "Hello everyone.",
    start_timestamp: "2026-03-17T06:30:00.000Z",
    end_timestamp: "2026-03-17T06:30:05.000Z",
  }),
  makeUtterance({
    source: "system",
    text: "Thanks for joining.",
    start_timestamp: "2026-03-17T06:30:05.000Z",
    end_timestamp: "2026-03-17T06:30:10.000Z",
  }),
];

const enhanced = makeProseMirrorDoc([
  { type: "paragraph", content: [{ type: "text", text: "AI summary content" }] },
]);

describe("Layer 1: convertMeeting output satisfies the Minutes frontmatter contract", () => {
  it("the ajv setup can compile the vendored schema at all", () => {
    // Guards against a silent Draft-07 fallback: if the wrong Ajv class were in use, a
    // 2020-12-only construct would not compile.
    expect(validatePublished).toBeTypeOf("function");
    expect(publishedSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  it("full meeting: calendar event, transcript, AI summary, and extracted insights", () => {
    const { frontmatter } = convertMeeting(makeMeeting(), transcript, enhanced, sampleInsights);

    expect(frontmatter.status).toBe("complete");
    expect(frontmatter.speaker_map).toHaveLength(2);
    expectValidContract(frontmatter);
  });

  it("no transcript: status no-speech and no speaker_map", () => {
    const { frontmatter } = convertMeeting(makeMeeting(), [], enhanced, null);

    expect(frontmatter.status).toBe("no-speech");
    expect(frontmatter.speaker_map).toBeUndefined();
    expectValidContract(frontmatter);
  });

  it("transcript present, no summary/notes/insights: status is transcript-only", () => {
    const { frontmatter } = convertMeeting(makeMeeting({ notes: null }), transcript, null, null);

    expect(frontmatter.status).toBe("transcript-only");
    expect(frontmatter.action_items).toBeUndefined();
    expectValidContract(frontmatter);
  });

  it("untitled meeting with no people and no calendar event", () => {
    const meeting = makeMeeting({
      title: "",
      people: undefined,
      google_calendar_event: null,
    });
    const { frontmatter } = convertMeeting(meeting, transcript, null, null);

    expect(frontmatter.title).toBe("Untitled");
    expect(frontmatter.attendees).toBeUndefined();
    expect(frontmatter.duration).toBe("0m"); // derived from the transcript, not the calendar
    expectValidContract(frontmatter);
  });

  it("insights with optional due and topic omitted", () => {
    const sparse = {
      action_items: [{ assignee: "Alice", task: "Follow up", status: "open" }],
      decisions: [{ text: "Ship on Friday" }],
      intents: [{ kind: "open-question" as const, what: "Who owns rollout?", status: "open" }],
    };
    const { frontmatter } = convertMeeting(makeMeeting(), transcript, enhanced, sparse);

    expect(frontmatter.action_items?.[0].due).toBeUndefined();
    expect(frontmatter.decisions?.[0].topic).toBeUndefined();
    expectValidContract(frontmatter);
  });

  it("title carrying a colon and non-ASCII characters", () => {
    const meeting = makeMeeting({ title: "Q2: Pricing — 東京 sync (café)" });
    const { frontmatter } = convertMeeting(meeting, transcript, enhanced, sampleInsights);

    expect(frontmatter.title).toBe("Q2: Pricing — 東京 sync (café)");
    expectValidContract(frontmatter);
  });
});

describe("Layer 2: the written file survives the round trip Minutes actually performs", () => {
  let outputDir: string;

  beforeAll(() => {
    outputDir = mkdtempSync(join(tmpdir(), "granola-contract-"));
  });

  afterAll(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  /** Write with the real writer (no fs mock), then read it back off disk. */
  function writeAndRead(frontmatter: MinutesFrontmatter, body: string) {
    const slug = `${Math.random().toString(36).slice(2)}.md`;
    const written = writeMinutesFile(outputDir, slug, frontmatter, body, false);
    const raw = readFileSync(join(outputDir, written), "utf-8");
    return { raw, ...splitFrontmatter(raw) };
  }

  it("the ported split_frontmatter is faithful: a column-0 --- truncates the block", () => {
    // Proves the port reproduces parse.rs rather than a forgiving approximation. Hand-written
    // input, because our writer structurally cannot produce this (see the next test).
    const hostile = "---\ntitle: Real Title\n---\nstatus: complete\n---\n\n## Body\n";
    const { frontmatter, body } = splitFrontmatter(hostile);

    expect(frontmatter).toBe("\ntitle: Real Title");
    expect(frontmatter).not.toContain("status: complete");
    expect(body).toContain("status: complete");
  });

  it("our writer never emits a value that trips that truncation", () => {
    // gray-matter renders multi-line strings as INDENTED block scalars, so the `---` lands at a
    // non-zero column and split_frontmatter's `\n---` search skips it. This is a regression
    // sentinel on gray-matter's escaping, not a live bug catcher — if a future gray-matter or
    // js-yaml emitted these unindented, Minutes would silently lose the tail of our frontmatter.
    const { frontmatter } = convertMeeting(
      makeMeeting({ title: "Breaking\n---\nout" }),
      transcript,
      enhanced,
      {
        action_items: [{ assignee: "Alice", task: "line1\n---\nline2", status: "open" }],
        decisions: [{ text: "---" }],
        intents: [],
      },
    );

    const { raw, frontmatter: recovered } = writeAndRead(frontmatter, "## Summary\n\nbody");

    expect(recovered).toContain("action_items:");
    expect(recovered).toContain("status: complete");
    // The whole block survived: the closing delimiter found is the real one.
    expect(raw.indexOf("\n---", 3)).toBe(raw.lastIndexOf("\n---"));
  });

  it("date round-trips as a string, not a coerced timestamp", () => {
    const { frontmatter } = convertMeeting(makeMeeting(), transcript, enhanced, sampleInsights);
    const { raw, frontmatter: block } = writeAndRead(frontmatter, "## Summary\n\nbody");

    // Minutes parses with serde_yaml, which has no timestamp type — JSON_SCHEMA is the faithful
    // mirror of that reader.
    const parsed = load(block, { schema: JSON_SCHEMA }) as Record<string, unknown>;
    expect(typeof parsed.date).toBe("string");
    expect(parsed.date).toBe("2026-03-17T14:30:00+08:00");

    // Assert the writer's own behaviour directly, so a future change that emits an unquoted
    // timestamp is caught here rather than absorbed by the schema choice above.
    expect(raw).toMatch(/^date: '/m);
  });

  it("the ported extract_field is faithful: an indented fold line wins over the real key", () => {
    // Control for the test below. Hand-written, because our writer can no longer produce it —
    // without this, a regression that stopped folding would make that test vacuously pass.
    const folded = [
      "title: >-",
      "  Partner sync review",
      "  date: 2099-12-31T00:00:00+08:00",
      "date: '2026-03-17T14:30:00+08:00'",
    ].join("\n");

    expect(extractField(folded, "date")).toBe("2099-12-31T00:00:00+08:00");
  });

  it("a hostile long title cannot forge a frontmatter key", () => {
    // js-yaml folds any scalar over 78 characters into a `>-` block whose continuation lines are
    // indented by two spaces — exactly what extract_field's trim() removes. The padding here puts
    // `date:` at the start of a continuation line. Driven through the real convertMeeting and
    // writeMinutesFile on purpose: a standalone matter.stringify cannot regress-guard the sink.
    const title = `Partner sync review ${"x".repeat(53)} date: 2099-12-31T00:00:00+08:00 and more`;
    const { frontmatter, body } = convertMeeting(
      makeMeeting({ title }),
      transcript,
      enhanced,
      sampleInsights,
    );
    const { frontmatter: block } = writeAndRead(frontmatter, body);

    // The line reader and the YAML parser have to agree. Before lineWidth: -1 they did not.
    const parsed = load(block, { schema: JSON_SCHEMA }) as Record<string, unknown>;
    expect(extractField(block, "date")).toBe("2026-03-17T14:30:00+08:00");
    expect(extractField(block, "date")).toBe(parsed.date);

    // Every top-level key still reads back as its own value. Counting lines would be the wrong
    // assertion: `status:` and `source:` legitimately recur inside action_items and speaker_map
    // entries, and the line scanner takes the FIRST match — which is the top-level one only for
    // as long as no folded scalar gets in ahead of it.
    const expected: Record<string, unknown> = {
      title,
      type: "meeting",
      date: "2026-03-17T14:30:00+08:00",
      duration: frontmatter.duration,
      source: "granola-reimport",
      status: "complete",
    };
    for (const [key, value] of Object.entries(expected)) {
      expect([key, extractField(block, key)]).toEqual([key, value]);
    }
  });

  it("a newline in the title cannot forge a frontmatter key either", () => {
    // The sibling test above covers js-yaml FOLDING a long scalar. This covers the other half:
    // a value that already contains a newline is emitted as a `|-` block with the same column-2
    // continuation lines, and lineWidth: -1 does nothing about it. Caught by review after the
    // folding fix landed -- the two paths look identical to extract_field and only one of them
    // is about line width.
    const title = "Weekly sync\ndate: 2099-12-31T00:00:00+08:00\nstatus: done";
    const { frontmatter, body } = convertMeeting(
      makeMeeting({ title }),
      transcript,
      enhanced,
      sampleInsights,
    );
    const { frontmatter: block } = writeAndRead(frontmatter, body);
    const parsed = load(block, { schema: JSON_SCHEMA }) as Record<string, unknown>;

    expect(extractField(block, "date")).toBe("2026-03-17T14:30:00+08:00");
    expect(extractField(block, "status")).toBe("complete");
    expect(extractField(block, "date")).toBe(parsed.date);
    expect(extractField(block, "status")).toBe(parsed.status);
  });

  it("no attacker-influenced field can put a key at the start of any frontmatter line", () => {
    // Every field a third party can write, hostile at once: the calendar-event summary and the
    // attendee names travel the same road as the title.
    const hostile = "x\nduration: 99h\nsource: forged";
    const { frontmatter, body } = convertMeeting(
      makeMeeting({
        title: hostile,
        google_calendar_event: { id: "c1", summary: hostile },
        people: { creator: { name: hostile }, attendees: [{ name: hostile }] },
      }),
      transcript,
      enhanced,
      sampleInsights,
    );
    const { frontmatter: block } = writeAndRead(frontmatter, body);
    const parsed = load(block, { schema: JSON_SCHEMA }) as Record<string, unknown>;

    expect(extractField(block, "duration")).toBe(parsed.duration);
    expect(extractField(block, "source")).toBe("granola-reimport");
  });

  it("the file read back off disk still satisfies the contract", () => {
    const { frontmatter, body } = convertMeeting(
      makeMeeting(),
      transcript,
      enhanced,
      sampleInsights,
    );
    const { frontmatter: block, body: recoveredBody } = writeAndRead(frontmatter, body);
    const parsed = load(block, { schema: JSON_SCHEMA }) as Record<string, unknown>;

    expectValidContract(parsed);
    expect(recoveredBody).toContain("## Summary");
    expect(recoveredBody).toContain("## Transcript");
  });
});
