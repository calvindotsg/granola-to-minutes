import type {
  GranolaMeeting,
  GranolaUtterance,
  MeetingInsights,
  ProseMirrorDoc,
  ProseMirrorNode,
} from "../src/types.js";

export function makeMeeting(overrides?: Partial<GranolaMeeting>): GranolaMeeting {
  return {
    id: "test-meeting-id-001",
    title: "Weekly Sync",
    created_at: "2026-03-17T06:30:00.000Z", // UTC → 2026-03-17T14:30:00+08:00 in SGT
    updated_at: "2026-03-17T07:00:00.000Z",
    notes: null,
    people: {
      creator: { name: "John Smith", email: "john@example.com" },
      attendees: [
        { name: "Alice Chen", email: "alice@example.com" },
        { name: "Bob Lee", email: "bob@example.com" },
      ],
    },
    google_calendar_event: {
      id: "cal-event-001",
      summary: "Weekly Sync",
      start: { dateTime: "2026-03-17T14:30:00+08:00", timeZone: "Asia/Singapore" },
      end: { dateTime: "2026-03-17T15:00:00+08:00", timeZone: "Asia/Singapore" },
    },
    ...overrides,
  };
}

export function makeUtterance(overrides?: Partial<GranolaUtterance>): GranolaUtterance {
  return {
    source: "microphone",
    text: "Hello everyone.",
    start_timestamp: "2026-03-17T06:30:00.000Z",
    end_timestamp: "2026-03-17T06:30:05.000Z",
    ...overrides,
  };
}

export function makeProseMirrorDoc(nodes?: ProseMirrorNode[]): ProseMirrorDoc {
  return {
    type: "doc",
    content: nodes ?? [{ type: "paragraph", content: [{ type: "text", text: "Test content" }] }],
  };
}

export const sampleInsights: MeetingInsights = {
  action_items: [
    { assignee: "Alice", task: "Send pricing doc", due: "Friday", status: "open" },
    { assignee: "Bob", task: "Review competitor grid", status: "done" },
  ],
  decisions: [{ text: "Run pricing experiment at monthly billing", topic: "pricing" }],
  intents: [
    {
      kind: "commitment",
      what: "Share revised pricing model",
      who: "Alice",
      status: "open",
      by_date: "Tuesday",
    },
  ],
};
