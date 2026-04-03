import { describe, expect, it } from "vitest";
import { COLLISION, INSIGHTS_SCHEMA, SLUG, SPEAKERS, TIMEZONE } from "../../src/config.js";

describe("TIMEZONE", () => {
  it("has offsetMinutes consistent with label", () => {
    expect(TIMEZONE.offsetMinutes).toBe(480);
    expect(TIMEZONE.label).toBe("+08:00");
  });
});

describe("SPEAKERS", () => {
  it("has local speaker with expected shape", () => {
    expect(SPEAKERS.local).toEqual({
      label: "SPEAKER_0",
      defaultName: "Local user",
      confidence: "high",
      source: "deterministic",
    });
  });

  it("has remote speaker with expected shape", () => {
    expect(SPEAKERS.remote).toEqual({
      label: "SPEAKER_1",
      defaultName: "Remote participants",
      confidence: "low",
      source: "deterministic",
    });
  });
});

describe("SLUG", () => {
  it("has maxLength of 60", () => {
    expect(SLUG.maxLength).toBe(60);
  });
});

describe("COLLISION", () => {
  it("has maxAttempts of 99", () => {
    expect(COLLISION.maxAttempts).toBe(99);
  });
});

describe("INSIGHTS_SCHEMA", () => {
  it("requires action_items, decisions, and intents at top level", () => {
    expect(INSIGHTS_SCHEMA.required).toEqual(["action_items", "decisions", "intents"]);
  });

  it("defines action_items with required fields", () => {
    const actionItems = INSIGHTS_SCHEMA.properties.action_items.items;
    expect(actionItems.required).toContain("assignee");
    expect(actionItems.required).toContain("task");
    expect(actionItems.required).toContain("status");
  });

  it("defines decisions with required text field", () => {
    const decisions = INSIGHTS_SCHEMA.properties.decisions.items;
    expect(decisions.required).toContain("text");
  });

  it("defines intents with required fields", () => {
    const intents = INSIGHTS_SCHEMA.properties.intents.items;
    expect(intents.required).toContain("kind");
    expect(intents.required).toContain("what");
    expect(intents.required).toContain("status");
  });

  it("restricts action_items status to open/done", () => {
    const statusEnum = INSIGHTS_SCHEMA.properties.action_items.items.properties.status.enum;
    expect(statusEnum).toEqual(["open", "done"]);
  });

  it("restricts intents kind to valid values", () => {
    const kindEnum = INSIGHTS_SCHEMA.properties.intents.items.properties.kind.enum;
    expect(kindEnum).toEqual(["action-item", "decision", "open-question", "commitment"]);
  });
});
