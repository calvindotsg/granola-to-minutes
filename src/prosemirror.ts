import type { ProseMirrorDoc, ProseMirrorNode } from "./types.js";

/** Convert a ProseMirror JSON document to a markdown string. */
export function toMarkdown(doc: ProseMirrorDoc | null): string {
  if (!doc?.content) return "";
  return doc.content.map((n) => nodeToMd(n)).join("\n\n");
}

function nodeToMd(node: ProseMirrorNode): string {
  switch (node.type) {
    case "heading": {
      const lvl = (node.attrs?.level as number) || 1;
      return `${"#".repeat(lvl)} ${inlineToMd(node.content)}`;
    }
    case "paragraph":
      return inlineToMd(node.content);
    case "bulletList":
      return (node.content || []).map((li) => nodeToMd(li)).join("\n");
    case "orderedList":
      return (node.content || [])
        .map((li, i) => nodeToMd(li).replace(/^- /, `${i + 1}. `))
        .join("\n");
    case "listItem":
      return `- ${(node.content || []).map((c) => nodeToMd(c)).join("\n  ")}`;
    case "blockquote":
      return (node.content || []).map((c) => `> ${nodeToMd(c)}`).join("\n");
    case "codeBlock": {
      const lang = (node.attrs?.language as string) || "";
      return `\`\`\`${lang}\n${inlineToMd(node.content)}\n\`\`\``;
    }
    case "horizontalRule":
      return "---";
    case "text":
      return applyMarks(node.text || "", node.marks);
    default:
      return node.content ? node.content.map((c) => nodeToMd(c)).join("") : "";
  }
}

function inlineToMd(content?: ProseMirrorNode[]): string {
  return content ? content.map((n) => nodeToMd(n)).join("") : "";
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
