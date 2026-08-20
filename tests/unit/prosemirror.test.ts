import { describe, expect, it } from "vitest";
import { toMarkdown } from "../../src/prosemirror.js";
import type { ProseMirrorNode } from "../../src/types.js";
import { makeProseMirrorDoc } from "../fixtures.js";

describe("toMarkdown", () => {
  it("returns empty string for null input", () => {
    expect(toMarkdown(null)).toBe("");
  });

  it("returns empty string for doc with no content", () => {
    expect(toMarkdown({ type: "doc", content: [] })).toBe("");
  });

  it("converts a single paragraph", () => {
    const doc = makeProseMirrorDoc([
      { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
    ]);
    expect(toMarkdown(doc)).toBe("Hello world");
  });

  it("converts headings at different levels", () => {
    const doc = makeProseMirrorDoc([
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "H1" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "H2" }] },
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "H3" }] },
    ]);
    const result = toMarkdown(doc);
    expect(result).toContain("# H1");
    expect(result).toContain("## H2");
    expect(result).toContain("### H3");
  });

  it("defaults heading level to 1 when attrs missing", () => {
    const doc = makeProseMirrorDoc([
      { type: "heading", content: [{ type: "text", text: "Default" }] },
    ]);
    expect(toMarkdown(doc)).toBe("# Default");
  });

  it("converts bullet list", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Item 1" }] }],
          },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Item 2" }] }],
          },
        ],
      },
    ]);
    const result = toMarkdown(doc);
    expect(result).toContain("- Item 1");
    expect(result).toContain("- Item 2");
  });

  it("converts ordered list", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }],
          },
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }],
          },
        ],
      },
    ]);
    const result = toMarkdown(doc);
    expect(result).toContain("1. First");
    expect(result).toContain("2. Second");
  });

  it("converts blockquote", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted text" }] }],
      },
    ]);
    expect(toMarkdown(doc)).toContain("> Quoted text");
  });

  it("converts code block without language", () => {
    const doc = makeProseMirrorDoc([
      { type: "codeBlock", content: [{ type: "text", text: "const x = 1;" }] },
    ]);
    const result = toMarkdown(doc);
    expect(result).toContain("```\nconst x = 1;\n```");
  });

  it("converts code block with language", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "codeBlock",
        attrs: { language: "typescript" },
        content: [{ type: "text", text: "const x = 1;" }],
      },
    ]);
    const result = toMarkdown(doc);
    expect(result).toContain("```typescript\nconst x = 1;\n```");
  });

  it("converts horizontal rule", () => {
    const doc = makeProseMirrorDoc([{ type: "horizontalRule" }]);
    expect(toMarkdown(doc)).toBe("---");
  });

  it("applies bold mark", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "bold", marks: [{ type: "bold" }] }],
      },
    ]);
    expect(toMarkdown(doc)).toContain("**bold**");
  });

  it("applies strong mark (alias for bold)", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "strong", marks: [{ type: "strong" }] }],
      },
    ]);
    expect(toMarkdown(doc)).toContain("**strong**");
  });

  it("applies italic mark", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "italic", marks: [{ type: "italic" }] }],
      },
    ]);
    expect(toMarkdown(doc)).toContain("*italic*");
  });

  it("applies code mark", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "code", marks: [{ type: "code" }] }],
      },
    ]);
    expect(toMarkdown(doc)).toContain("`code`");
  });

  it("applies strikethrough mark", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "struck", marks: [{ type: "strike" }] }],
      },
    ]);
    expect(toMarkdown(doc)).toContain("~~struck~~");
  });

  it("handles mixed content with multiple node types", () => {
    const doc = makeProseMirrorDoc([
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      { type: "paragraph", content: [{ type: "text", text: "Body text" }] },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }],
          },
        ],
      },
    ]);
    const result = toMarkdown(doc);
    expect(result).toContain("## Title");
    expect(result).toContain("Body text");
    expect(result).toContain("- Item");
  });

  it("falls through unknown node types to default content concatenation", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "unknownNode",
        content: [{ type: "text", text: "fallback text" }],
      },
    ]);
    expect(toMarkdown(doc)).toContain("fallback text");
  });

  it("handles unknown node type without content", () => {
    const doc = makeProseMirrorDoc([{ type: "unknownEmpty" }]);
    expect(toMarkdown(doc)).toBe("");
  });
});

describe("resource bounds", () => {
  it("clamps a heading level to 6 rather than repeating # a billion times", () => {
    // attrs is untyped third-party JSON. Unclamped, this ~90-byte node expands to a
    // multi-hundred-megabyte string.
    const doc = makeProseMirrorDoc([
      { type: "heading", attrs: { level: 1_000_000_000 }, content: [{ type: "text", text: "X" }] },
    ]);

    expect(toMarkdown(doc)).toBe("###### X");
  });

  it("clamps a negative or zero heading level up to 1", () => {
    const doc = makeProseMirrorDoc([
      { type: "heading", attrs: { level: -5 }, content: [{ type: "text", text: "A" }] },
      { type: "heading", attrs: { level: 0 }, content: [{ type: "text", text: "B" }] },
    ]);

    expect(toMarkdown(doc)).toBe("# A\n\n# B");
  });

  it("ignores a non-numeric heading level", () => {
    const doc = makeProseMirrorDoc([
      {
        type: "heading",
        attrs: { level: "9999" as unknown as number },
        content: [{ type: "text", text: "C" }],
      },
      { type: "heading", attrs: { level: Number.NaN }, content: [{ type: "text", text: "D" }] },
    ]);

    expect(toMarkdown(doc)).toBe("###### C\n\n# D");
  });

  it("stops descending at the depth cap instead of blowing the stack", () => {
    let node: ProseMirrorNode = { type: "text", text: "bottom" };
    for (let i = 0; i < 5_000; i++) {
      node = { type: "blockquote", content: [node] };
    }

    expect(() => toMarkdown(makeProseMirrorDoc([node]))).not.toThrow();
  });

  it("still renders a document nested well within the cap", () => {
    let node: ProseMirrorNode = { type: "text", text: "bottom" };
    for (let i = 0; i < 5; i++) {
      node = { type: "blockquote", content: [node] };
    }

    expect(toMarkdown(makeProseMirrorDoc([node]))).toContain("bottom");
  });
});
