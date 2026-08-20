import { describe, expect, it } from "vitest";
import { convertMeeting } from "../../src/converter.js";
import { makeMeeting, makeProseMirrorDoc, makeUtterance, sampleInsights } from "../fixtures.js";

describe("convertMeeting", () => {
  describe("full meeting with all fields", () => {
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
    const meeting = makeMeeting();
    const result = convertMeeting(meeting, transcript, enhanced, sampleInsights);

    it("sets title from meeting", () => {
      expect(result.frontmatter.title).toBe("Weekly Sync");
    });

    it("sets type to meeting", () => {
      expect(result.frontmatter.type).toBe("meeting");
    });

    it("converts date to SGT (+08:00)", () => {
      expect(result.frontmatter.date).toBe("2026-03-17T14:30:00+08:00");
    });

    it("calculates duration from calendar event", () => {
      expect(result.frontmatter.duration).toBe("30m");
    });

    it("sets source to granola-reimport", () => {
      expect(result.frontmatter.source).toBe("granola-reimport");
    });

    it("sets status to complete when transcript exists", () => {
      expect(result.frontmatter.status).toBe("complete");
    });

    it("includes attendee names", () => {
      expect(result.frontmatter.attendees).toEqual(["Alice Chen", "Bob Lee"]);
    });

    it("includes all people (creator + attendees, deduplicated)", () => {
      expect(result.frontmatter.people).toContain("John Smith");
      expect(result.frontmatter.people).toContain("Alice Chen");
      expect(result.frontmatter.people).toContain("Bob Lee");
    });

    it("builds speaker map with creator as SPEAKER_0", () => {
      expect(result.frontmatter.speaker_map).toHaveLength(2);
      expect(result.frontmatter.speaker_map?.[0].speaker_label).toBe("SPEAKER_0");
      expect(result.frontmatter.speaker_map?.[0].name).toBe("John Smith");
      expect(result.frontmatter.speaker_map?.[0].confidence).toBe("high");
    });

    it("sets calendar_event from google calendar summary", () => {
      expect(result.frontmatter.calendar_event).toBe("Weekly Sync");
    });

    it("includes action items from insights", () => {
      expect(result.frontmatter.action_items).toHaveLength(2);
      expect(result.frontmatter.action_items?.[0].assignee).toBe("Alice");
    });

    it("includes decisions from insights", () => {
      expect(result.frontmatter.decisions).toHaveLength(1);
    });

    it("includes intents from insights", () => {
      expect(result.frontmatter.intents).toHaveLength(1);
    });

    it("body contains Summary section", () => {
      expect(result.body).toContain("## Summary");
      expect(result.body).toContain("AI summary content");
    });

    it("body contains Transcript section", () => {
      expect(result.body).toContain("## Transcript");
      expect(result.body).toContain("[SPEAKER_0 0:00] Hello everyone.");
      expect(result.body).toContain("[SPEAKER_1 0:05] Thanks for joining.");
    });

    it("generates slug with date prefix and title", () => {
      expect(result.slug).toMatch(/^2026-03-17-weekly-sync\.md$/);
    });
  });

  describe("minimal meeting (title + date only)", () => {
    const meeting = makeMeeting({
      title: "Quick Chat",
      people: undefined,
      google_calendar_event: null,
      notes: null,
    });
    const result = convertMeeting(meeting, [], null, null);

    it("sets duration to 0m with no calendar or transcript", () => {
      expect(result.frontmatter.duration).toBe("0m");
    });

    it("sets status to no-speech with empty transcript", () => {
      expect(result.frontmatter.status).toBe("no-speech");
    });

    it("omits speaker_map when no transcript", () => {
      expect(result.frontmatter.speaker_map).toBeUndefined();
    });

    it("omits attendees when none present", () => {
      expect(result.frontmatter.attendees).toBeUndefined();
    });

    it("omits action_items when insights is null", () => {
      expect(result.frontmatter.action_items).toBeUndefined();
    });
  });

  describe("no transcript, has enhanced summary", () => {
    const enhanced = makeProseMirrorDoc([
      { type: "paragraph", content: [{ type: "text", text: "Meeting summary" }] },
    ]);
    const result = convertMeeting(makeMeeting(), [], enhanced, null);

    it("sets status to no-speech", () => {
      expect(result.frontmatter.status).toBe("no-speech");
    });

    it("body contains Summary but no Transcript", () => {
      expect(result.body).toContain("## Summary");
      expect(result.body).not.toContain("## Transcript");
    });
  });

  describe("has transcript, no enhanced summary", () => {
    const transcript = [
      makeUtterance({ text: "First utterance" }),
      makeUtterance({
        text: "Second utterance",
        start_timestamp: "2026-03-17T06:35:00.000Z",
        end_timestamp: "2026-03-17T06:35:05.000Z",
      }),
    ];
    const result = convertMeeting(
      makeMeeting({ google_calendar_event: null }),
      transcript,
      null,
      null,
    );

    it("sets status to transcript-only when there is no summary and no notes", () => {
      expect(result.frontmatter.status).toBe("transcript-only");
    });

    it("body contains Transcript but no Summary", () => {
      expect(result.body).toContain("## Transcript");
      expect(result.body).not.toContain("## Summary");
    });

    it("stays complete when human notes exist without an AI summary", () => {
      const withNotes = convertMeeting(
        makeMeeting({
          google_calendar_event: null,
          notes: makeProseMirrorDoc([
            { type: "paragraph", content: [{ type: "text", text: "Handwritten note" }] },
          ]),
        }),
        transcript,
        null,
        null,
      );

      expect(withNotes.frontmatter.status).toBe("complete");
      expect(withNotes.body).toContain("## Notes");
    });

    it("stays transcript-only when notes are structurally present but empty", () => {
      // An "empty" ProseMirror doc still has nodes — a structural check would wrongly see content.
      const emptyNotes = convertMeeting(
        makeMeeting({
          google_calendar_event: null,
          notes: makeProseMirrorDoc([{ type: "paragraph", content: [] }]),
        }),
        transcript,
        null,
        null,
      );

      expect(emptyNotes.frontmatter.status).toBe("transcript-only");
      expect(emptyNotes.body).not.toContain("## Notes");
    });

    it("calculates duration from transcript timestamps", () => {
      expect(result.frontmatter.duration).toBe("5m");
    });
  });

  describe("slug generation", () => {
    it("sanitizes special characters", () => {
      const result = convertMeeting(makeMeeting({ title: "Q&A: Pricing Review!" }), [], null, null);
      expect(result.slug).toMatch(/^2026-03-17-qa-pricing-review\.md$/);
    });

    it("truncates long titles to max length", () => {
      const longTitle = "A".repeat(100);
      const result = convertMeeting(makeMeeting({ title: longTitle }), [], null, null);
      const slugTitle = result.slug.replace(/^2026-03-17-/, "").replace(/\.md$/, "");
      expect(slugTitle.length).toBeLessThanOrEqual(60);
    });

    it("uses 'untitled' for empty title", () => {
      const result = convertMeeting(makeMeeting({ title: "" }), [], null, null);
      expect(result.slug).toContain("untitled");
    });
  });

  describe("duration formatting", () => {
    it("formats less than 60 minutes", () => {
      const meeting = makeMeeting({
        google_calendar_event: {
          id: "cal-1",
          summary: "Short",
          start: { dateTime: "2026-03-17T14:00:00+08:00", timeZone: "Asia/Singapore" },
          end: { dateTime: "2026-03-17T14:25:00+08:00", timeZone: "Asia/Singapore" },
        },
      });
      expect(convertMeeting(meeting, [], null, null).frontmatter.duration).toBe("25m");
    });

    it("formats exactly 60 minutes as 1h", () => {
      const meeting = makeMeeting({
        google_calendar_event: {
          id: "cal-1",
          summary: "Hour",
          start: { dateTime: "2026-03-17T14:00:00+08:00", timeZone: "Asia/Singapore" },
          end: { dateTime: "2026-03-17T15:00:00+08:00", timeZone: "Asia/Singapore" },
        },
      });
      expect(convertMeeting(meeting, [], null, null).frontmatter.duration).toBe("1h");
    });

    it("formats mixed hours and minutes", () => {
      const meeting = makeMeeting({
        google_calendar_event: {
          id: "cal-1",
          summary: "Long",
          start: { dateTime: "2026-03-17T14:00:00+08:00", timeZone: "Asia/Singapore" },
          end: { dateTime: "2026-03-17T15:30:00+08:00", timeZone: "Asia/Singapore" },
        },
      });
      expect(convertMeeting(meeting, [], null, null).frontmatter.duration).toBe("1h30m");
    });
  });

  describe("person name resolution", () => {
    it("prefers fullName from details", () => {
      const meeting = makeMeeting({
        people: {
          creator: {
            name: "John",
            email: "john@example.com",
            details: { person: { name: { fullName: "John Smith III" } } },
          },
        },
      });
      const result = convertMeeting(meeting, [], null, null);
      expect(result.frontmatter.people).toContain("John Smith III");
    });

    it("falls back to name when no fullName", () => {
      const meeting = makeMeeting({
        people: { creator: { name: "Jane", email: "jane@example.com" } },
      });
      const result = convertMeeting(meeting, [], null, null);
      expect(result.frontmatter.people).toContain("Jane");
    });

    it("falls back to email when no name", () => {
      const meeting = makeMeeting({
        people: { creator: { email: "anon@example.com" } },
      });
      const result = convertMeeting(meeting, [], null, null);
      expect(result.frontmatter.people).toContain("anon@example.com");
    });
  });

  describe("speaker map", () => {
    it("uses default name when creator has no name", () => {
      const meeting = makeMeeting({ people: { creator: undefined } });
      const transcript = [makeUtterance()];
      const result = convertMeeting(meeting, transcript, null, null);
      expect(result.frontmatter.speaker_map?.[0].name).toBe("Local user");
    });

    it("SPEAKER_1 is always Remote participants", () => {
      const transcript = [makeUtterance()];
      const result = convertMeeting(makeMeeting(), transcript, null, null);
      expect(result.frontmatter.speaker_map?.[1].name).toBe("Remote participants");
      expect(result.frontmatter.speaker_map?.[1].confidence).toBe("low");
    });
  });

  describe("insights injection", () => {
    it("omits empty insights arrays from frontmatter", () => {
      const emptyInsights = { action_items: [], decisions: [], intents: [] };
      const result = convertMeeting(makeMeeting(), [], null, emptyInsights);
      expect(result.frontmatter.action_items).toBeUndefined();
      expect(result.frontmatter.decisions).toBeUndefined();
      expect(result.frontmatter.intents).toBeUndefined();
    });
  });

  describe("date conversion", () => {
    it("converts UTC midnight to SGT next day when crossing boundary", () => {
      const meeting = makeMeeting({ created_at: "2026-03-17T16:30:00.000Z" });
      const result = convertMeeting(meeting, [], null, null);
      // 16:30 UTC + 8h = 00:30 next day SGT
      expect(result.frontmatter.date).toBe("2026-03-18T00:30:00+08:00");
    });

    it("returns a safe sentinel for an invalid date, never the raw input", () => {
      const meeting = makeMeeting({ created_at: "not-a-date" });
      const result = convertMeeting(meeting, [], null, null);
      expect(result.frontmatter.date).toBe("1970-01-01T00:00:00+08:00");
    });

    it("keeps path separators out of the slug when created_at is hostile", () => {
      // created_at is Granola's server-side timestamp, so no counted attacker can set it. The
      // sentinel exists so that if one ever could, buildSlug still cannot be walked out of
      // --output-dir: it splices date.slice(0, 10) into the filename unsanitized.
      const meeting = makeMeeting({ created_at: "../../../etc/passwd" });
      const result = convertMeeting(meeting, [], null, null);

      expect(result.slug).not.toContain("/");
      expect(result.slug).not.toContain("..");
      expect(result.slug.startsWith("1970-01-01")).toBe(true);
    });
  });

  describe("transcript formatting", () => {
    it("uses relative timestamps from first utterance", () => {
      const transcript = [
        makeUtterance({
          source: "microphone",
          text: "Hello",
          start_timestamp: "2026-03-17T06:30:00.000Z",
        }),
        makeUtterance({
          source: "system",
          text: "Hi",
          start_timestamp: "2026-03-17T06:31:30.000Z",
        }),
      ];
      const result = convertMeeting(makeMeeting(), transcript, null, null);
      expect(result.body).toContain("[SPEAKER_0 0:00] Hello");
      expect(result.body).toContain("[SPEAKER_1 1:30] Hi");
    });

    it("formats hours when transcript is long", () => {
      const transcript = [
        makeUtterance({ text: "Start", start_timestamp: "2026-03-17T06:00:00.000Z" }),
        makeUtterance({
          source: "system",
          text: "Later",
          start_timestamp: "2026-03-17T07:05:30.000Z",
        }),
      ];
      const result = convertMeeting(makeMeeting(), transcript, null, null);
      expect(result.body).toContain("[SPEAKER_1 1:05:30] Later");
    });
  });
});
