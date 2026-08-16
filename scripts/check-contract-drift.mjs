#!/usr/bin/env node
/**
 * Compare the pinned upstream Minutes artifacts against what upstream serves today.
 *
 * Exit 0 = in sync. Exit 1 = drift (report on stdout). Exit 2 = could not check (network).
 * A fetch failure is deliberately NOT drift — it must not open an issue.
 *
 * Run locally with:  node scripts/check-contract-drift.mjs
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const watch = JSON.parse(readFileSync(join(repoRoot, "tests/contract/upstream-watch.json"), "utf-8"));

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Strip insta's `---\nsource: …\nexpression: …\n---` preamble, leaving the JSON body. */
function stripInstaHeader(text) {
  const lines = text.split("\n");
  const delimiters = [];
  for (let i = 0; i < lines.length && delimiters.length < 2; i++) {
    if (lines[i] === "---") delimiters.push(i);
  }
  if (delimiters.length < 2) return text;
  return lines.slice(delimiters[1] + 1).join("\n");
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "granola-to-minutes-drift-check" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

const drifted = [];
const unreachable = [];

for (const source of watch.sources) {
  let upstream;
  try {
    upstream = await fetchText(source.url);
  } catch (error) {
    unreachable.push({ ...source, error: error.message });
    continue;
  }

  if (source.stripInstaHeader) upstream = stripInstaHeader(upstream);

  if (source.compare === "file") {
    const local = readFileSync(join(repoRoot, source.path), "utf-8");
    if (local !== upstream) {
      drifted.push({ ...source, detail: `vendored copy at \`${source.path}\` differs from upstream` });
    }
  } else {
    const actual = sha256(upstream);
    if (actual !== source.sha256) {
      drifted.push({ ...source, detail: `sha256 \`${source.sha256}\` → \`${actual}\`` });
    }
  }
}

if (unreachable.length > 0) {
  for (const source of unreachable) {
    console.error(`could not fetch ${source.name}: ${source.error}`);
  }
  process.exit(2);
}

if (drifted.length === 0) {
  console.log(`In sync with Minutes ${watch.upstreamVersion} (pinned ${watch.pinnedOn}).`);
  process.exit(0);
}

console.log("The Minutes frontmatter contract has moved upstream.\n");
for (const source of drifted) {
  console.log(`### ${source.name}\n`);
  console.log(`- ${source.detail}`);
  console.log(`- Source: ${source.url}`);
  console.log(`- Why this is watched: ${source.why}\n`);
}
console.log("---\n");
console.log("Refresh instructions: [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md#refreshing-the-vendored-minutes-schema).");
console.log("Re-pin the hashes in `tests/contract/upstream-watch.json` in the same change.");
process.exit(1);
