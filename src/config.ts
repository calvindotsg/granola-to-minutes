// Business rules and defaults for the Granola → Minutes conversion pipeline.
// Operational constants (timeouts, delays, buffers) stay in their respective modules.

/** Timezone for date conversion — Singapore Time (UTC+8) */
export const TIMEZONE = {
  offsetMinutes: 480,
  label: "+08:00",
} as const;

/** Source identifier written into Minutes frontmatter */
export const SOURCE_LABEL = "granola-reimport" as const;

/** LLM extraction settings for Claude CLI */
export const LLM = {
  model: "haiku",
  timeout: 60_000,
} as const;

/** Speaker attribution defaults (Granola provides microphone vs system, not individual IDs) */
export const SPEAKERS = {
  local: {
    label: "SPEAKER_0",
    defaultName: "Local user",
    confidence: "high" as const,
    source: "deterministic" as const,
  },
  remote: {
    label: "SPEAKER_1",
    defaultName: "Remote participants",
    confidence: "low" as const,
    source: "deterministic" as const,
  },
} as const;

/** Slug generation constraints */
export const SLUG = {
  maxLength: 60,
} as const;

/** File collision resolution limit */
export const COLLISION = {
  maxAttempts: 99,
} as const;

/** JSON schema for structured LLM extraction of meeting insights */
export const INSIGHTS_SCHEMA = {
  type: "object",
  properties: {
    action_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          assignee: { type: "string" },
          task: { type: "string" },
          due: { type: "string" },
          status: { type: "string", enum: ["open", "done"] },
        },
        required: ["assignee", "task", "status"],
      },
    },
    decisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          topic: { type: "string" },
        },
        required: ["text"],
      },
    },
    intents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["action-item", "decision", "open-question", "commitment"],
          },
          what: { type: "string" },
          who: { type: "string" },
          status: { type: "string", enum: ["open", "done"] },
          by_date: { type: "string" },
        },
        required: ["kind", "what", "status"],
      },
    },
  },
  required: ["action_items", "decisions", "intents"],
} as const;
