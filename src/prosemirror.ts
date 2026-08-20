import type { ProseMirrorDoc, ProseMirrorNode } from "./types.js";

/**
 * ProseMirror headings are 1-6. `attrs` is untyped third-party JSON, so an unclamped
 * `"#".repeat(level)` turns a ~90-byte node into a multi-hundred-megabyte string.
 */
const MAX_HEADING_LEVEL = 6;

/** Depth cap for the recursive walk: a pathologically nested document blows the stack otherwise. */
const MAX_DEPTH = 100;

/** Convert a ProseMirror JSON document to a markdown string. */
export function toMarkdown(doc: ProseMirrorDoc | null): string {
  if (!doc?.content) return "";
  return doc.content.map((n) => nodeToMd(n, 0)).join("\n\n");
}

function nodeToMd(node: ProseMirrorNode, depth: number): string {
  if (depth > MAX_DEPTH) return "";
  const next = depth + 1;

  switch (node.type) {
    case "heading": {
      const level = Math.trunc(Number(node.attrs?.level)) || 1;
      const clamped = Math.min(Math.max(level, 1), MAX_HEADING_LEVEL);
      return `${"#".repeat(clamped)} ${inlineToMd(node.content, next)}`;
    }
    case "paragraph":
      return inlineToMd(node.content, next);
    case "bulletList":
      return (node.content || []).map((li) => nodeToMd(li, next)).join("\n");
    case "orderedList":
      return (node.content || [])
        .map((li, i) => nodeToMd(li, next).replace(/^- /, `${i + 1}. `))
        .join("\n");
    case "listItem":
      return `- ${(node.content || []).map((c) => nodeToMd(c, next)).join("\n  ")}`;
    case "blockquote":
      return (node.content || []).map((c) => `> ${nodeToMd(c, next)}`).join("\n");
    case "codeBlock": {
      const lang = (node.attrs?.language as string) || "";
      return `\`\`\`${lang}\n${inlineToMd(node.content, next)}\n\`\`\``;
    }
    case "horizontalRule":
      return "---";
    case "text":
      return applyMarks(node.text || "", node.marks);
    default:
      return node.content ? node.content.map((c) => nodeToMd(c, next)).join("") : "";
  }
}

function inlineToMd(content: ProseMirrorNode[] | undefined, depth: number): string {
  return content ? content.map((n) => nodeToMd(n, depth)).join("") : "";
}

function applyMarks(text: string, marks?: Array<{ type: string }>): string {
  if (!marks) return text;
  for (const m of marks) {
    if (m.type === "bold" || m.type === "strong") text = `**${text}**`;
    if (m.type === "italic" || m.type === "em") text = `*${text}*`;
    if (m.type === "code") text = `\`${text}\``;
    if (m.type === "strike") text = `~~${text}~~`;
  }
  return text;
}
