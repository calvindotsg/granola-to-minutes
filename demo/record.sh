#!/usr/bin/env bash
# demo/record.sh — Generate the demo GIF from a synthetic asciicast recording
#
# Uses fake meeting titles to avoid exposing real data. Fully reproducible —
# no Granola auth needed. Edit generate-cast.py to change meeting titles,
# greeting, timing, or theme.
#
# Requirements: python3, agg (brew install agg)
# Font: FiraCode Nerd Font installed in ~/Library/Fonts/
#
# Usage (from repo root):
#   bash demo/record.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CAST_FILE="$REPO_ROOT/demo.cast"
GIF_FILE="$SCRIPT_DIR/demo.gif"

echo "==> Generating synthetic recording..."
python3 "$SCRIPT_DIR/generate-cast.py" > "$CAST_FILE"

echo "==> Converting to GIF (Ayu Light + FiraCode Nerd Font)..."
agg --font-family "FiraCode Nerd Font" \
    --font-dir ~/Library/Fonts \
    --idle-time-limit 2 \
    --font-size 14 \
    "$CAST_FILE" "$GIF_FILE"

SIZE_KB=$(du -k "$GIF_FILE" | cut -f1)
echo "==> Done: $GIF_FILE (${SIZE_KB}KB)"

if [ "$SIZE_KB" -gt 5120 ]; then
  echo "==> GIF is over 5MB. Optimizing with gifsicle..."
  if command -v gifsicle &>/dev/null; then
    gifsicle --lossy=80 -k 128 -O2 "$GIF_FILE" -o "$GIF_FILE"
    SIZE_KB=$(du -k "$GIF_FILE" | cut -f1)
    echo "==> Optimized: ${SIZE_KB}KB"
  else
    echo "    Install gifsicle: brew install gifsicle"
  fi
fi

echo "==> Cast file at $CAST_FILE (gitignored)"
