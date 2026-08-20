import { describe, expect, it } from "vitest";
import {
  errorMessage,
  GranolaAuthError,
  GranolaNotInstalledError,
  MeetingNotFoundError,
  stripControlChars,
} from "../../src/utils.js";

describe("errorMessage", () => {
  it("extracts message from Error instance", () => {
    expect(errorMessage(new Error("something broke"))).toBe("something broke");
  });

  it("converts string to string", () => {
    expect(errorMessage("plain string error")).toBe("plain string error");
  });

  it("converts number to string", () => {
    expect(errorMessage(42)).toBe("42");
  });

  it("converts object to string", () => {
    expect(errorMessage({ code: "ENOENT" })).toBe("[object Object]");
  });

  it("converts null to string", () => {
    expect(errorMessage(null)).toBe("null");
  });

  it("converts undefined to string", () => {
    expect(errorMessage(undefined)).toBe("undefined");
  });
});

describe("GranolaNotInstalledError", () => {
  it("is an Error instance", () => {
    const err = new GranolaNotInstalledError();
    expect(err).toBeInstanceOf(Error);
  });

  it("has a message about installing granola-cli", () => {
    const err = new GranolaNotInstalledError();
    expect(err.message).toContain("granola-cli");
    expect(err.message).toContain("not installed");
  });
});

describe("GranolaAuthError", () => {
  it("is an Error instance", () => {
    const err = new GranolaAuthError();
    expect(err).toBeInstanceOf(Error);
  });

  it("has a message about authentication", () => {
    const err = new GranolaAuthError();
    expect(err.message).toContain("not authenticated");
  });
});

describe("MeetingNotFoundError", () => {
  it("is an Error instance", () => {
    const err = new MeetingNotFoundError("abc-123");
    expect(err).toBeInstanceOf(Error);
  });

  it("includes the noteId in the message", () => {
    const err = new MeetingNotFoundError("abc-123");
    expect(err.message).toContain("abc-123");
  });
});

describe("stripControlChars", () => {
  it("strips the C0 range", () => {
    expect(stripControlChars("Quarterly\u001B]0;pwned\u0007 review")).toBe(
      "Quarterly ]0;pwned  review",
    );
  });

  it("strips DEL and the C1 range as well as C0", () => {
    // \u009B is the 8-bit CSI: a terminal in 8-bit mode treats it exactly as ESC[. Tests that use
    // only \u001B leave this half of the character class deletable with the suite still green.
    expect(stripControlChars("a\u007Fb\u009Bc\u009Fd")).toBe("a b c d");
  });

  it("leaves ordinary text alone", () => {
    expect(stripControlChars("Q2 Pricing — 東京")).toBe("Q2 Pricing — 東京");
  });
});
