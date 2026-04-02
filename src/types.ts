// --- CLI options ---

export interface ExportOptions {
  outputDir: string;
  dryRun: boolean;
  skipLlm: boolean;
  noteId?: string;
  since?: string;
  verbose: boolean;
}

// --- Granola CLI output types (from granola-cli/src/types.ts) ---

export interface GranolaPeople {
  creator?: GranolaPerson;
  attendees?: GranolaPerson[];
}

export interface GranolaPerson {
  name?: string;
  email?: string;
  details?: {
    person?: { name?: { fullName?: string } };
    employment?: { title?: string; name?: string };
    company?: { name?: string };
  };
}

export interface ProseMirrorDoc {
  type: "doc";
  content: ProseMirrorNode[];
}

export interface ProseMirrorNode {
  type: string;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
}

export interface GranolaUtterance {
  source: "microphone" | "system";
  text: string;
  start_timestamp: string;
  end_timestamp: string;
  confidence?: number;
}

// Rich meeting data from `granola meeting list -o json`
// The list endpoint returns full Meeting objects (not just stubs)
export interface GranolaMeeting {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  workspace_id?: string;
  notes?: ProseMirrorDoc | null;
  notes_plain?: string | null;
  transcribe?: boolean;
  people?: GranolaPeople;
  google_calendar_event?: GranolaCalendarEvent | null;
  deleted_at?: string | null;
  type?: string;
}

export interface GranolaCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: Array<{ email: string; responseStatus?: string; self?: boolean }>;
}

// --- Minutes output types (from minutes/crates/reader/src/types.ts) ---

export interface MinutesFrontmatter {
  title: string;
  type: "meeting";
  date: string;
  duration: string;
  source: "granola-reimport";
  status: "complete" | "no-speech" | "transcript-only";
  attendees?: string[];
  people?: string[];
  speaker_map?: SpeakerAttribution[];
  calendar_event?: string;
  action_items?: ActionItem[];
  decisions?: Decision[];
  intents?: Intent[];
}

export interface SpeakerAttribution {
  speaker_label: string;
  name: string;
  confidence: "high" | "medium" | "low";
  source: "deterministic" | "llm" | "enrollment" | "manual";
}

export interface ActionItem {
  assignee: string;
  task: string;
  due?: string;
  status: string;
}

export interface Decision {
  text: string;
  topic?: string;
}

export interface Intent {
  kind: "action-item" | "decision" | "open-question" | "commitment";
  what: string;
  who?: string;
  status: string;
  by_date?: string;
}

export interface MeetingInsights {
  action_items: ActionItem[];
  decisions: Decision[];
  intents: Intent[];
}
