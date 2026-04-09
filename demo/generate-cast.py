#!/usr/bin/env python3
"""Generate a synthetic asciicast v3 recording with fake meeting data.

Includes Fish greeting and powerline prompt for personal branding.
Uses Ayu Light theme from Ghostty config. No PII — all meeting titles are generic.

Usage:
    python3 demo/generate-cast.py > demo.cast
    agg --theme custom --font-family "FiraCode Nerd Font" \\
        --font-dir ~/Library/Fonts --idle-time-limit 2 --font-size 14 \\
        demo.cast demo.gif
"""

import json
import random
import sys

# --- Ayu Light theme (from Ghostty /Applications/Ghostty.app/.../themes/Ayu Light) ---
HEADER = {
    "version": 3,
    "term": {
        "cols": 100,
        "rows": 24,
        "type": "xterm-ghostty",
        "version": "ghostty 1.3.1",
        "theme": {
            "fg": "#5c6166",
            "bg": "#f8f9fa",
            "palette": "#000000:#ea6c6d:#6cbf43:#eca944:#3199e1:#9e75c7:#46ba94:#bababa:#686868:#f07171:#86b300:#f2ae49:#399ee6:#a37acc:#4cbf99:#d1d1d1",
        },
    },
    "timestamp": 1775696939,
    "idle_time_limit": 1.0,
    "env": {"SHELL": "/opt/homebrew/bin/fish"},
}

# --- ANSI helpers ---
ESC = "\x1b"
RST = f"{ESC}[m"
BOLD = f"{ESC}[1m"


def fg(r, g, b):
    return f"{ESC}[38;2;{r};{g};{b}m"


def bg(r, g, b):
    return f"{ESC}[48;2;{r};{g};{b}m"


def fg_bg(fr, fg_, fb, br, bg_, bb):
    return f"{ESC}[38;2;{fr};{fg_};{fb};48;2;{br};{bg_};{bb}m"  # noqa: E501


# Prompt segment colors (Catppuccin Mocha palette — from starship.toml)
SEG_FG = fg(17, 17, 27)  # crust (#11111b) text on colored segments
SEP_START = "\ue0b6"  # Powerline left half-circle (rounded start)
SEP = "\ue0b0"         # Powerline right-pointing triangle (between segments)
SEP_END = "\ue0b4"     # Powerline right half-circle (rounded end)

# Segment bg colors (from [palettes.catppuccin_mocha])
C_RED = (243, 139, 168)       # #f38ba8
C_PEACH = (250, 179, 135)     # #fab387
C_YELLOW = (249, 226, 175)    # #f9e2af
C_GREEN = (166, 227, 161)     # #a6e3a1
C_SAPPHIRE = (116, 199, 236)  # #74c7ec
C_LAVENDER = (180, 190, 254)  # #b4befe

# Nerd Font symbols (from starship.toml)
ICON_MACOS = "\U000f0035"     # 󰀵 os.symbols.Macos
ICON_GIT = "\uf418"           # git_branch.symbol
ICON_NODE = "\ue718"          # nodejs.symbol
ICON_TIME = "\uf43a"          # in time.format


def segment_transition(from_color, to_color):
    """Powerline separator: fg=from_color on bg=to_color."""
    return f"{ESC}[48;2;{to_color[0]};{to_color[1]};{to_color[2]};38;2;{from_color[0]};{from_color[1]};{from_color[2]}m"


# --- Event list (delta timestamps for v3) ---
events = []


def emit(dt, data):
    events.append((dt, "o", data))


def emit_line(dt, text):
    emit(dt, text + "\r\n")


# --- Fish greeting (from ~/.config/fish/fish_greeting.fish) ---
# Morning greeting with Catppuccin Latte colors (light mode, 7AM-7PM)
# Icon: \uf185 (nf-fa-sun) + greeting + name + random message with trailing icon
GREETING_ICON = f"{fg(30, 102, 245)}{BOLD}\uf185  "  # nf-fa-sun (morning icon)
GREETING_TEXT = f"{fg(76, 79, 105)}{BOLD}Good morning"  # Latte Text
GREETING_NAME = f"{fg(136, 57, 239)}, Calvin!\r\n{RST}"  # Latte Mauve
GREETING_MOTTO = (
    f"\r\n{fg(64, 160, 43)}"  # Latte Green
    f"Hey there! Fresh day ahead. Let's see what cool stuff we can build together \uf0ad"
    f"\r\n{RST}"
)  # morning_messages[2] with nf-fa-wrench

emit(0.0, GREETING_ICON + GREETING_TEXT + GREETING_NAME + GREETING_MOTTO)

# --- Powerline prompt (matches starship.toml format string exactly) ---
prompt_parts = []

# Newline before prompt bar
prompt_parts.append("\r\n")

# Left edge: [](red) — rounded left half-circle in red on default bg
prompt_parts.append(f"{fg(*C_RED)}{SEP_START}")

# Segment 1: $os + $username (bg:red fg:crust)
prompt_parts.append(f"{bg(*C_RED)}{SEG_FG}{ICON_MACOS} calvin")

# Sep: [](bg:peach fg:red) — red→peach
prompt_parts.append(segment_transition(C_RED, C_PEACH))
prompt_parts.append(f"{SEP}{SEG_FG}")

# Segment 2: $directory (bg:peach fg:crust) — "[ $path ]"
prompt_parts.append(f" \u2026/granola-to-minutes ")

# Sep: [](bg:yellow fg:peach) — peach→yellow
prompt_parts.append(segment_transition(C_PEACH, C_YELLOW))
prompt_parts.append(f"{SEP}{SEG_FG}")

# Segment 3: $git_branch (bg:yellow fg:crust) — "[[ $symbol $branch ]"
prompt_parts.append(f" {ICON_GIT} main ")

# Sep: [](fg:yellow bg:green) — yellow→green
prompt_parts.append(segment_transition(C_YELLOW, C_GREEN))
prompt_parts.append(f"{SEP}{SEG_FG}")

# Segment 4: $nodejs (bg:green fg:crust) — "[[ $symbol( $version) ]"
prompt_parts.append(f" {ICON_NODE} v25.9.0 ")

# Sep: [](fg:green bg:sapphire) — green→sapphire
prompt_parts.append(segment_transition(C_GREEN, C_SAPPHIRE))
prompt_parts.append(f"{SEP}")

# $conda is empty — no content, but separators still render
# Sep: [](fg:sapphire bg:lavender) — sapphire→lavender
prompt_parts.append(segment_transition(C_SAPPHIRE, C_LAVENDER))
prompt_parts.append(f"{SEP}{SEG_FG}")

# Segment 5: $time (bg:lavender fg:crust) — "[[  $time ]"
prompt_parts.append(f" {ICON_TIME} 09:15 ")

# End: [ ](fg:lavender) — rounded right half-circle on default bg
prompt_parts.append(f"{ESC}[0m{fg(*C_LAVENDER)}{SEP_END}{ESC}[0m")

# $line_break + $character
prompt_parts.append(f"\r\n{BOLD}{fg(*C_GREEN)}\u276f{ESC}[0m ")

PROMPT = "".join(prompt_parts)
emit(0.1, PROMPT)

# --- Typing the command ---
CMD = "npx granola-to-minutes export --dry-run"
dt = 1.0  # Pause before typing starts
for i, char in enumerate(CMD):
    jitter = 0.045 + random.uniform(0, 0.025)
    emit(jitter if i > 0 else dt, char)

# Press enter
emit(0.15, "\r\n")

# --- CLI output ---
emit(0.3, "Checking granola-cli authentication...\r\n")
emit(0.1, "Fetching meeting list...\r\n")
emit(1.5, "Found 5 meetings to export\r\n\r\n")

# --- Meetings (fake titles, realistic timing) ---
MEETINGS = [
    ("Weekly Standup", "transcript, summary, notes", "2026-04-07-weekly-standup.md"),
    ("Product Review", "transcript, summary", "2026-04-07-product-review.md"),
    ("Q2 Planning", "summary, notes", "2026-04-04-q2-planning.md"),
    ("Design Sync", "transcript, summary, notes", "2026-04-03-design-sync.md"),
    ("Team Retro", "no-speech", "2026-04-01-team-retro.md"),
]

for i, (title, flags, filename) in enumerate(MEETINGS, 1):
    dt = 0.6 + random.uniform(0, 0.3)
    emit(dt, f"  [dry-run] Would write: {filename}\r\n")
    emit(0.0, f"[{i}/5] {title} ({flags}) -> {filename}\r\n")

# --- Summary ---
emit(0.3, "\r\n--- Export complete ---\r\n")
emit(0.0, "5 exported | 4 summary | 3 transcript | 3 notes | 1 no-speech | 0 errors\r\n")

# Hold, then return to prompt
emit(2.0, "\r\n")
emit(0.0, PROMPT)

# --- Output ---
print(json.dumps(HEADER, ensure_ascii=False))
for dt, typ, data in events:
    print(json.dumps([round(dt, 3), typ, data], ensure_ascii=False))
