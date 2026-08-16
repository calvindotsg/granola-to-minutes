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

  it("transcript present, no summary/notes/insights: status is complete", () => {
    // NOT "transcript-only" — converter.ts only ever emits complete | no-speech. Asserted
    // explicitly so this scenario cannot be mistaken for coverage of the third status value.
    const { frontmatter } = convertMeeting(makeMeeting({ notes: null }), transcript, null, null);

    expect(frontmatter.status).toBe("complete");
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
