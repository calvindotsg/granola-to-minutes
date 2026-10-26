#!/usr/bin/env python3
"""The merge-on-green rules that no file path can express: which changes need Calvin's review.

    gate-rules.py [--base REV] [--memory GLOB]... [--approver LOGIN]

Each repository's ./gate runs a vendored, sha256-pinned copy of this file (plan 3.4, Calvin's D5 and D6;
the orchestrator's 20 Oct ruling: one rules script, in calvindotsg/.github). It reads the change from
--base to HEAD and prints one line per rule, then

    needs-calvin=<reason; reason|none> review=<approved|missing|stale|not-needed|skipped-local>

THE RULES (each is "needs Calvin" when it fires)
    deleted   the change deletes a tracked file
    lines     over 1,000 changed lines, memory files excluded
    memory    over 20 memory files changed (a sweep)
    binaries  (informational, never fires) a binary file in the change is listed with its size at HEAD, or
              "deleted". Git counts a binary as 0 lines, so the lines rule cannot see it; there is no limit.
              Only the path and the byte count are printed, never contents.
    scan      an added line carries a secret's shape, or an email, phone number or chat id that the base
              tree does not already hold. The hit is named by file, line and kind; its value is never printed.

THE REVIEW
    In CI (GITHUB_ACTIONS=true, a pull_request or pull_request_review event), when a rule fires, the
    approver's latest review must be APPROVED on the PR's head sha; one on an older sha is stale. It reads
    the reviews with GATE_GITHUB_TOKEN, which needs pull-requests: read and nothing more. A PR the approver
    opened himself is self-authored: GitHub never counts an author's own review, so it says how to proceed.
    Locally the review is not checked: it prints review=skipped-local and the rules are advisory. In Actions
    under any other event there is no PR to read, so a rule that fires there cannot be decided (exit 2).

EXIT CODES
    0 nothing needs Calvin, or he approved the head, or a local run; 1 needs Calvin and not approved on the
    head, or self-authored (CI); 2 cannot decide (bad base, unreadable event, API failure), which fails closed.

THE BASE, when --base is not given
    In Actions under a pull_request or pull_request_review event, HEAD must be GitHub's merge of the event's
    head sha, and its first parent is the base; any other HEAD there exits 2. Everywhere else, the merge-base
    with origin/main (else main). A branch head that merged main is never measured from its first parent.
"""

from __future__ import annotations

import fnmatch
import http.client
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

MAX_LINES = 1000
MAX_MEMORY = 20
DEFAULT_MEMORY = ["projects/*/memory/*", "memory/*"]


def origin(url: str) -> tuple:
    p = urllib.parse.urlparse(url)
    return (p.scheme, p.netloc)


# Tests only: the API override is honoured for plain-http loopback alone; anything else is GitHub over https.
API = os.environ.get("GATE_GITHUB_API", "https://api.github.com")
if origin(API) != ("https", "api.github.com") and not (
        urllib.parse.urlparse(API).scheme == "http" and urllib.parse.urlparse(API).hostname == "127.0.0.1"):
    API = "https://api.github.com"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect becomes an HTTP error: urllib would carry the Authorization header to wherever it points."""

    def redirect_request(self, *args, **kwargs):
        return None


OPENER = urllib.request.build_opener(NoRedirect)

SECRETS = [
    ("github token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})")),
    ("anthropic key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}")),
    ("openai key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9]{32,}")),
    ("aws key id", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("1password token", re.compile(r"\bops_[A-Za-z0-9_-]{40,}")),
]
IDENTIFIERS = [
    ("email", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    ("phone", re.compile(r"(?<![\w+])\+\d{1,3}[ -]?\d{3,4}[ -]?\d{4}\b|(?<![\w-])[689]\d{3}[ -]\d{4}\b")),
    ("chat id", re.compile(r"(?<![\w-])-100\d{9,13}\b")),
]
# Addresses that identify no one. Each domain is anchored at the end: a domain under example.com.evil.sg is someone's,
# and so is noreply@ at any domain not named here.
SAFE_EMAIL = re.compile(r"(^noreply@(anthropic\.com|github\.com)|@users\.noreply\.github\.com|@example\.(com|org|net)"
                        r"|\.(test|invalid|example))$", re.I)


def git(*args: str) -> str:
    # Bytes that are not UTF-8 (a font, a latin-1 file, an odd file name) must neither crash the run nor change:
    # surrogateescape carries them through, so a path read here is the same path when it goes back to git (F7).
    p = subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", errors="surrogateescape")
    if p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {p.stderr.strip()[:200]}")
    return p.stdout


def default_base() -> str:
    """GitHub's PR checkout is a merge commit whose first parent is the base and whose second is the PR head.
    Only there is HEAD^1 the base: a branch head that merged main also has two parents, and its first is the
    old branch tip (F12). So in Actions under a PR event, HEAD must be that merge of the event's head sha, or
    the base cannot be decided; everywhere else it is main's merge-base."""
    if os.environ.get("GITHUB_ACTIONS") == "true" and os.environ.get("GITHUB_EVENT_NAME") in (
            "pull_request", "pull_request_review"):
        try:
            with open(os.environ["GITHUB_EVENT_PATH"]) as f:
                head = json.load(f)["pull_request"]["head"]["sha"]
        except (OSError, KeyError, TypeError, ValueError) as e:
            raise RuntimeError(f"cannot read the PR head from the event ({type(e).__name__}): pass --base")
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) == 3 and parents[2] == head:
            return parents[1]
        raise RuntimeError("HEAD is not GitHub's merge of this PR's head: pass --base")
    for ref in ("origin/main", "main"):
        try:
            return git("merge-base", ref, "HEAD").strip()
        except RuntimeError:
            continue
    raise RuntimeError("no base: pass --base")


def is_memory(path: str, globs: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(path, g) for g in globs)


def in_base(base: str, rx: re.Pattern, needle: str) -> bool:
    """True if the base holds needle as a whole identifier: rx finds exactly it on some base line, not a longer one."""
    p = subprocess.run(["git", "grep", "-h", "-F", "-e", needle, base, "--"], capture_output=True, text=True,
                       errors="replace")
    return p.returncode == 0 and any(m.group(0) == needle for line in p.stdout.split("\n") for m in rx.finditer(line))


def rules(base: str, memory: list[str]) -> list[tuple[str, str]]:
    """[(rule, reason)] for every rule that fires."""
    hits = []
    deleted = [p for p in git("diff", "--name-only", "-z", "--no-renames", "--diff-filter=D", base, "HEAD").split("\0") if p]
    print(f"rule deleted: {len(deleted)} file(s)" + (f" ({', '.join(deleted[:5])})" if deleted else ""))
    if deleted:
        hits.append(("deleted", f"deletes {len(deleted)} tracked file(s)"))

    lines = mem = 0
    binaries = []
    for row in git("diff", "--numstat", "-z", "--no-renames", base, "HEAD").split("\0"):
        if not row:
            continue
        add, rm, path = row.split("\t", 2)
        if add == "-" and rm == "-":
            try:
                size = f"{int(git('cat-file', '-s', f'HEAD:{path}').strip())} bytes"
            except (RuntimeError, ValueError):
                size = "deleted"
            binaries.append(f"rule binaries: {path} {size}")
        if is_memory(path, memory):
            mem += 1
            continue
        lines += (int(add) if add.isdigit() else 0) + (int(rm) if rm.isdigit() else 0)
    print("\n".join(binaries + [f"rule binaries: {len(binaries)} binary file(s), listed with no limit"]))
    print(f"rule lines: {lines} changed outside memory (limit {MAX_LINES})")
    if lines > MAX_LINES:
        hits.append(("lines", f"{lines} changed lines"))
    print(f"rule memory: {mem} memory file(s) changed (limit {MAX_MEMORY})")
    if mem > MAX_MEMORY:
        hits.append(("memory", f"{mem} memory files"))

    # One diff per file, named by -z (never quoted), so no header line or odd path can hide a file from the scan.
    # Before a file's first @@ every line is header; after it every line is a hunk header or carries a one-char
    # prefix, so a "+" line is always an added line. Split on newlines only: splitlines() would also break on
    # a form feed or \x1c inside a line and drop the rest of it from the scan.
    found = []
    for path in git("diff", "--name-only", "-z", "--no-renames", "--diff-filter=d", base, "HEAD").split("\0"):
        if not path:
            continue
        hunk, n = False, 0
        # --text: a file git or the PR's own .gitattributes calls binary is still read line by line.
        for line in git("--literal-pathspecs", "diff", "-U0", "--text", "--no-textconv", "--no-color", "--no-ext-diff",
                        "--no-renames", base, "HEAD", "--", path).split("\n"):
            if line.startswith("@@"):
                m = re.search(r"\+(\d+)", line)
                hunk, n = True, int(m.group(1)) if m else 0
                continue
            if not hunk or not line.startswith("+"):
                continue
            text = line[1:]
            for kind, rx in SECRETS:
                if rx.search(text):
                    found.append(f"{path}:{n} {kind}")
            for kind, rx in IDENTIFIERS:
                for m in rx.finditer(text):
                    value = m.group(0)
                    if kind == "email" and SAFE_EMAIL.search(value):
                        continue
                    if not in_base(base, rx, value):
                        found.append(f"{path}:{n} new {kind}")
            n += 1
    print(f"rule scan: {len(found)} hit(s)" + "".join(f"\n  {f}" for f in found[:20]))
    if found:
        hits.append(("scan", f"scan hit ({len(found)})"))
    return hits


def api(path: str, token: str) -> list:
    out: list = []
    url = API + path
    while url:
        req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json",
                                                   "Authorization": f"Bearer {token}",
                                                   "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "gate-rules"})
        with OPENER.open(req, timeout=30) as resp:
            page = json.loads(resp.read().decode() or "[]")
            if not isinstance(page, list):
                raise ValueError("the reviews API did not return a list")
            out += page
            m = re.search(r'<([^>]+)>;\s*rel="next"', resp.headers.get("Link") or "")
            # The token goes only to the API's own scheme and host: a next link elsewhere is an error, not a skip.
            if m and origin(m.group(1)) != origin(API):
                raise ValueError("the next page is outside the API")
            url = m.group(1) if m else ""
    return out


def review(approver: str) -> str:
    """approved | missing | stale | self-authored, from the approver's latest decisive review of the PR."""
    with open(os.environ["GITHUB_EVENT_PATH"]) as f:
        pr = json.load(f)["pull_request"]
    head = pr["head"]["sha"]
    if pr["user"]["login"] == approver:
        return "self-authored"
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ.get("GATE_GITHUB_TOKEN") or ""
    if not token:
        raise RuntimeError("GATE_GITHUB_TOKEN is not set")
    mine = [r for r in api(f"/repos/{repo}/pulls/{pr['number']}/reviews?per_page=100", token)
            if (r.get("user") or {}).get("login") == approver
            and r.get("state") in ("APPROVED", "CHANGES_REQUESTED", "DISMISSED")]
    if not mine or mine[-1]["state"] != "APPROVED":
        return "missing"
    return "approved" if mine[-1].get("commit_id") == head else "stale"


def main(argv: list[str]) -> int:
    sys.stdout.reconfigure(errors="backslashreplace")   # such a path prints escaped, never as a crash (F7)
    sys.stderr.reconfigure(errors="backslashreplace")
    base, memory, approver = None, [], "calvindotsg"
    i = 0
    while i < len(argv):
        if argv[i] in ("--base", "--memory", "--approver") and i + 1 < len(argv):
            if argv[i] == "--base":
                base = argv[i + 1]
            elif argv[i] == "--memory":
                memory.append(argv[i + 1])
            else:
                approver = argv[i + 1]
            i += 2
        else:
            print(f"gate-rules: unknown argument {argv[i]}\n" + __doc__.split("\n\n")[1], file=sys.stderr)
            return 2
    try:
        base = base or default_base()
        hits = rules(base, memory or DEFAULT_MEMORY)
    except (RuntimeError, ValueError) as e:
        print(f"needs-calvin=undecided review=not-needed\ngate-rules: {e}", file=sys.stderr)
        return 2
    reasons = "; ".join(r for _, r in hits) or "none"
    actions = os.environ.get("GITHUB_ACTIONS") == "true"
    event = os.environ.get("GITHUB_EVENT_NAME")
    if not hits:
        state = "not-needed"
    elif not actions:
        state = "skipped-local"
    elif event not in ("pull_request", "pull_request_review"):
        print(f"needs-calvin={reasons} review=undecided\ngate-rules: a {event} run has no PR whose review could "
              "clear this", file=sys.stderr)
        return 2
    else:
        try:
            state = review(approver)
        except (OSError, KeyError, TypeError, AttributeError, ValueError, RuntimeError, urllib.error.URLError,
                http.client.HTTPException) as e:
            print(f"needs-calvin={reasons} review=undecided\ngate-rules: cannot read the review: {e}",
                  file=sys.stderr)
            return 2
    print(f"needs-calvin={reasons} review={state}")
    if state == "skipped-local":
        print("gate-rules: local run, review not checked (advisory)")
    if state == "self-authored":
        print(f"gate-rules: opened as {approver}, who cannot approve his own PR: re-open it via gh-bot, "
              "or before phase 6 he merges it himself")
    return 1 if state in ("missing", "stale", "self-authored") else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
