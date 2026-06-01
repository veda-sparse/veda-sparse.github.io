#!/usr/bin/env bash
# Populate _assets/ from the author's curated tiers, with prompt captions.
#   compare  = 2B-best (subset) + 12B-good (subset)  -> _assets/comparisons/
#   samples  = 2B-good + 2B-fair (subset) + 12B-fair -> _assets/gallery/
# Run scripts/process_media.sh afterwards.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${SRC_ROOT:-/Users/bytedance/Downloads/seer_videos_collection}"
P304="/Users/bytedance/Downloads/final_test_304_rewrite_v63.txt"
PMOT="/Users/bytedance/Downloads/motion_bench_176.txt"

F2S="$SRC/2B_480P/sparse_0.9/final304/videos"
F2F="$SRC/2B_480P/full/final304/videos"
M12S="$SRC/12B_720P/sparse/motion_bench/videos"
M12F="$SRC/12B_720P/FA3/motion_bench/videos"

A="$ROOT/_assets"
rm -rf "$A/comparisons" "$A/gallery"; mkdir -p "$A/comparisons" "$A/gallery"

# short caption: prompt line (n+1), trimmed to ~78 chars on a word boundary
shortcap() { # promptfile n
  local line; line="$(sed -n "$(( $2 + 1 ))p" "$1")"
  echo "$line" | awk '{ if (length($0)>80){ s=substr($0,1,78); sub(/ [^ ]*$/,"",s); print s"…" } else print $0 }'
}
findfile() { ls "$1/${2}__"*.mp4 2>/dev/null | head -1; }

# ---- comparisons (fair amount) ----
i=1
add_cmp() { # full sparse promptfile n title2
  local full="$1" sp="$2" pf="$3" n="$4" t2="$5"
  [ -f "$full" ] && [ -f "$sp" ] || { echo "  ! skip cmp n=$n (missing)"; return; }
  local nm; nm="$(printf 'c%02d_%s' "$i" "$n")"
  local d="$A/comparisons/$nm"; mkdir -p "$d"
  cp "$full" "$d/full.mp4"; cp "$sp" "$d/veda.mp4"
  { shortcap "$pf" "$n"; echo "$t2"; } > "$d/label.txt"
  echo "  + cmp $nm"; i=$((i+1))
}
echo "==> comparisons"
for n in 4 54 89 138 189; do add_cmp "$(findfile "$F2F" "$n")" "$(findfile "$F2S" "$n")" "$P304" "$n" "Waver-T2V-1B · 480P · 90% sparse vs. Full Attention"; done
for n in 3 34 69;        do add_cmp "$(findfile "$M12F" "$n")" "$(findfile "$M12S" "$n")" "$PMOT" "$n" "Waver-T2V-12B · 720P · 95% sparse vs. Full Attention"; done

# ---- samples (marquee) : sparse outputs only ----
j=1
add_sample() { # sparse promptfile n
  local sp="$1" pf="$2" n="$3"
  [ -f "$sp" ] || { echo "  ! skip sample n=$n"; return; }
  local nm; nm="$(printf 's%02d_%s' "$j" "$n")"
  cp "$sp" "$A/gallery/$nm.mp4"
  shortcap "$pf" "$n" > "$A/gallery/$nm.txt"
  echo "  + sample $nm"; j=$((j+1))
}
echo "==> samples"
for n in 13 39 56 63 80 93 113 121 123 127 137 168 172 174 237; do add_sample "$(findfile "$F2S" "$n")" "$P304" "$n"; done
for n in 5 36 52 119 155 207;                                     do add_sample "$(findfile "$F2S" "$n")" "$P304" "$n"; done
for n in 6 24 29;                                                 do add_sample "$(findfile "$M12S" "$n")" "$PMOT" "$n"; done

echo "==> done. comparisons:$((i-1)) samples:$((j-1))"
