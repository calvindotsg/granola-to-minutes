import { SLUG, SOURCE_LABEL, SPEAKERS, TIMEZONE } from "./config.js";
import { toMarkdown } from "./prosemirror.js";
import type {
  GranolaMeeting,
  GranolaPerson,
  GranolaUtterance,
  MeetingInsights,
  MinutesFrontmatter,
  ProseMirrorDoc,
  SpeakerAttribution,
} from "./types.js";

export interface ConvertedMeeting {
  frontmatter: MinutesFrontmatter;
  body: string;
  slug: string;
}

/**
 * Transform a Granola meeting into Minutes-native markdown format.
 * @param meeting - Meeting metadata from `granola meeting list`
 * @param transcript - Utterances from `granola meeting transcript`
 * @param enhanced - AI summary from `granola meeting enhanced`
 * @param insights - Structured extraction from Claude CLI (or null)
 * @returns Frontmatter, markdown body, and filename slug
 */
export function convertMeeting(
  meeting: GranolaMeeting,
  transcript: GranolaUtterance[],
  enhanced: ProseMirrorDoc | null,
  insights: MeetingInsights | null,
): ConvertedMeeting {
  const title = meeting.title || "Untitled";
  const date = toLocalDate(meeting.created_at);
  const duration = calcDuration(meeting, transcript);
  const hasTranscript = transcript.length > 0;

  const attendeeNames = resolveAttendeeNames(meeting.people?.attendees);
  const creatorName = resolvePersonName(meeting.people?.creator);
  const allPeople = [...new Set([creatorName, ...attendeeNames].filter(Boolean))] as string[];

  const status: MinutesFrontmatter["status"] = hasTranscript ? "complete" : "no-speech";

  const speakerMap = buildSpeakerMap(hasTranscript, creatorName);
  const calSummary = meeting.google_calendar_event?.summary;

  const frontmatter: MinutesFrontmatter = {
    title,
    type: "meeting",
    date,
    duration,
    source: SOURCE_LABEL,
    status,
  };

  if (attendeeNames.length > 0) frontmatter.attendees = attendeeNames;
  if (allPeople.length > 0) frontmatter.people = allPeople;
  if (speakerMap.length > 0) frontmatter.speaker_map = speakerMap;
  if (calSummary) frontmatter.calendar_event = calSummary;
  if (insights?.action_items?.length) frontmatter.action_items = insights.action_items;
  if (insights?.decisions?.length) frontmatter.decisions = insights.decisions;
  if (insights?.intents?.length) frontmatter.intents = insights.intents;

  const body = buildBody(enhanced, meeting.notes, transcript);
  const slug = buildSlug(date, title);

  return { frontmatter, body, slug };
}

function toLocalDate(utcIso: string): string {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return utcIso;
  const local = new Date(d.getTime() + TIMEZONE.offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}${TIMEZONE.label}`
  );
}

function calcDuration(meeting: GranolaMeeting, transcript: GranolaUtterance[]): string {
  const cal = meeting.google_calendar_event;
  if (cal?.start?.dateTime && cal?.end?.dateTime) {
    const start = new Date(cal.start.dateTime).getTime();
    const end = new Date(cal.end.dateTime).getTime();
    return formatDuration(end - start);
  }

  if (transcript.length >= 2) {
    const first = new Date(transcript[0].start_timestamp).getTime();
    const last = new Date(transcript[transcript.length - 1].end_timestamp).getTime();
    return formatDuration(last - first);
  }

  return "0m";
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
}

function resolvePersonName(person?: GranolaPerson): string | null {
  if (!person) return null;
  return person.details?.person?.name?.fullName || person.name || person.email || null;
}

function resolveAttendeeNames(attendees?: GranolaPerson[]): string[] {
  if (!attendees) return [];
  return attendees.map((a) => resolvePersonName(a)).filter((n): n is string => n !== null);
}

function buildSpeakerMap(hasTranscript: boolean, creatorName: string | null): SpeakerAttribution[] {
  if (!hasTranscript) return [];
  return [
    {
      speaker_label: SPEAKERS.local.label,
      name: creatorName || SPEAKERS.local.defaultName,
      confidence: SPEAKERS.local.confidence,
      source: SPEAKERS.local.source,
    },
    {
      speaker_label: SPEAKERS.remote.label,
      name: SPEAKERS.remote.defaultName,
      confidence: SPEAKERS.remote.confidence,
      source: SPEAKERS.remote.source,
    },
  ];
}

function buildBody(
  enhanced: ProseMirrorDoc | null,
  notesRaw: ProseMirrorDoc | null | undefined,
  transcript: GranolaUtterance[],
): string {
  const sections: string[] = [];

  const summaryMd = toMarkdown(enhanced).trim();
  if (summaryMd) {
    sections.push(`## Summary\n\n${summaryMd}`);
  }

  const notesMd = toMarkdown(notesRaw ?? null).trim();
  if (notesMd) {
    sections.push(`## Notes\n\n${notesMd}`);
  }

  if (transcript.length > 0) {
    sections.push(`## Transcript\n\n${formatTranscript(transcript)}`);
  }

  return sections.join("\n\n");
}

function formatTranscript(utterances: GranolaUtterance[]): string {
  const baseTime = new Date(utterances[0].start_timestamp).getTime();

  return utterances
    .map((u) => {
      const speaker = u.source === "microphone" ? SPEAKERS.local.label : SPEAKERS.remote.label;
      const relMs = new Date(u.start_timestamp).getTime() - baseTime;
      const ts = formatTimestamp(relMs);
      return `[${speaker} ${ts}] ${u.text}`;
    })
    .join("\n");
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

function buildSlug(date: string, title: string): string {
  const datePrefix = date.slice(0, 10);
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, SLUG.maxLength)
    .replace(/-$/, "");

  return titleSlug ? `${datePrefix}-${titleSlug}.md` : `${datePrefix}-untitled.md`;
}
