#!/usr/bin/env bash
# Render an HTML file to PNG screenshots (desktop + mobile) via headless Chrome.
# Usage: ./scripts/shot.sh path/to/file.html outprefix [deskH] [mobH]
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
html="$1"; out="$2"; dh="${3:-3400}"; mh="${4:-3000}"
# resolve to absolute file URL
abs="$(cd "$(dirname "$html")" && pwd)/$(basename "$html")"
url="file://$abs"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
  --force-device-scale-factor=1 --window-size=1440,"$dh" \
  --virtual-time-budget=4000 --screenshot="${out}_desktop.png" "$url" >/dev/null 2>&1 || true
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
  --force-device-scale-factor=1 --window-size=390,"$mh" \
  --virtual-time-budget=4000 --screenshot="${out}_mobile.png" "$url" >/dev/null 2>&1 || true
echo "wrote ${out}_desktop.png ${out}_mobile.png"
