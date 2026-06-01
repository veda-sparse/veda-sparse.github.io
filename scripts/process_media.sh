#!/usr/bin/env bash
# =============================================================================
# Veda project page — one-click media pipeline
# 一键媒体处理脚本：压缩 + 转格式 + 生成清单(manifest)
#
# 用法 / Usage:
#   1) 把视频放进 _assets/ (见下面的目录约定)，然后运行:
#        ./scripts/process_media.sh
#   2) 想换视频？删掉/替换 _assets/ 里的文件，再跑一次即可。
#
# 目录约定 / Input layout (under _assets/):
#   _assets/comparisons/<NN_name>/full.mp4   <- 全注意力 (FA3) 原视频
#   _assets/comparisons/<NN_name>/veda.mp4   <- Veda 稀疏结果
#   _assets/comparisons/<NN_name>/label.txt  <- 可选: 第1行标题, 第2行副标题/prompt
#   _assets/gallery/<NN_name>.mp4            <- 画廊视频 (单个)
#   _assets/gallery/<NN_name>.txt            <- 可选: 一行说明文字
#
# 输出 / Outputs:
#   static/videos/comparisons/<name>_full.mp4  +  _veda.mp4   (web 优化 H.264)
#   static/posters/comparisons/<name>.webp                    (海报图)
#   static/videos/gallery/<name>.webp                         (动态 WebP, 自动循环)
#   static/posters/gallery/<name>.webp                        (静态海报)
#   static/js/media.js   ->  window.__VEDA_MEDIA__ = {...}     (页面读取的清单)
#
# 所有编码参数都在下面，可按需调整。
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$ROOT/_assets"
OUT_VID="$ROOT/static/videos"
OUT_POS="$ROOT/static/posters"
OUT_JS="$ROOT/static/js/media.js"

# ---- 编码参数 / Encoding knobs ------------------------------------------------
# Comparison (before/after slider) MP4 — quality matters here.
CMP_HEIGHT="${CMP_HEIGHT:-720}"     # output height (keeps aspect)
CMP_CRF="${CMP_CRF:-26}"            # lower = higher quality / bigger file
CMP_PRESET="${CMP_PRESET:-slow}"
CMP_MAXDUR="${CMP_MAXDUR:-0}"       # 0 = full clip, else trim to N seconds
CMP_POSTER_FRAC="${CMP_POSTER_FRAC:-0.0}"  # poster time as fraction of duration

# Gallery animated WebP — lightweight, loops forever, autoplays everywhere.
GAL_WIDTH="${GAL_WIDTH:-512}"
GAL_FPS="${GAL_FPS:-12}"
GAL_START="${GAL_START:-1.0}"      # start time (s)
GAL_DUR="${GAL_DUR:-5.0}"          # loop length (s)
GAL_QUALITY="${GAL_QUALITY:-62}"   # libwebp quality 0..100
GAL_MP4="${GAL_MP4:-1}"            # also emit a tiny mp4 fallback (1/0)

FONT=""  # not needed here

have() { command -v "$1" >/dev/null 2>&1; }
have ffmpeg || { echo "ERROR: ffmpeg not found"; exit 1; }
have ffprobe || { echo "ERROR: ffprobe not found"; exit 1; }
have cwebp  || echo "WARN: cwebp not found (posters will use ffmpeg libwebp)"

mkdir -p "$OUT_VID/comparisons" "$OUT_VID/gallery" \
         "$OUT_POS/comparisons" "$OUT_POS/gallery" "$(dirname "$OUT_JS")"

dur_of() { ffprobe -v error -select_streams v:0 -show_entries format=duration \
           -of default=noprint_wrappers=1:nokey=1 "$1" 2>/dev/null | head -1; }

# json string escaper
jesc() { python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"; }

# --- encode one comparison clip to web mp4 ---
enc_cmp_mp4() { # src dst
  local src="$1" dst="$2" durarg=()
  [ "$CMP_MAXDUR" != "0" ] && durarg=(-t "$CMP_MAXDUR")
  # bash 3.2-safe empty-array expansion under `set -u`
  ffmpeg -y -loglevel error -i "$src" ${durarg[@]+"${durarg[@]}"} -an \
    -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -vf "scale=-2:'min(${CMP_HEIGHT},ih)':flags=lanczos" \
    -crf "$CMP_CRF" -preset "$CMP_PRESET" -movflags +faststart "$dst"
}

# --- webp poster from a video at a given time ---
poster_webp() { # src dst time width
  local src="$1" dst="$2" t="$3" w="$4" tmp
  tmp="$(mktemp -t poster).png"
  ffmpeg -y -loglevel error -ss "$t" -i "$src" -frames:v 1 \
    -vf "scale=${w}:-2:flags=lanczos" "$tmp"
  if have cwebp; then cwebp -quiet -q 86 -m 6 "$tmp" -o "$dst" >/dev/null
  else ffmpeg -y -loglevel error -i "$tmp" -c:v libwebp -quality 86 "$dst"; fi
  rm -f "$tmp"
}

# --- small looping tile clip for the marquee strip ---
gallery_tile() { # src dst
  local src="$1" dst="$2"
  ffmpeg -y -loglevel error -ss "$GAL_START" -t "$GAL_DUR" -i "$src" -an \
    -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -vf "scale=${GAL_TILE_W:-360}:-2:flags=lanczos" \
    -crf 30 -preset slow -movflags +faststart "$dst"
}
# --- full clip (height-capped) for the click-to-enlarge lightbox ---
gallery_full() { # src dst
  local src="$1" dst="$2"
  ffmpeg -y -loglevel error -i "$src" -an \
    -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -vf "scale=-2:'min(${GAL_FULL_H:-540},ih)':flags=lanczos" \
    -crf 27 -preset slow -movflags +faststart "$dst"
}

# =============================================================================
echo "==> Processing comparisons"
CMP_JSON="["
first=1
if [ -d "$ASSETS/comparisons" ]; then
  for d in "$ASSETS"/comparisons/*/; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    full="$d/full.mp4"; veda="$d/veda.mp4"
    [ -f "$full" ] || { echo "  skip $name (no full.mp4)"; continue; }
    [ -f "$veda" ] || { echo "  skip $name (no veda.mp4)"; continue; }
    echo "  - $name"
    enc_cmp_mp4 "$full" "$OUT_VID/comparisons/${name}_full.mp4"
    enc_cmp_mp4 "$veda" "$OUT_VID/comparisons/${name}_veda.mp4"
    d_sec="$(dur_of "$veda")"; [ -z "$d_sec" ] && d_sec=10
    ptime="$(python3 -c "print(max(0.0,float('$d_sec')*$CMP_POSTER_FRAC))")"
    poster_webp "$veda" "$OUT_POS/comparisons/${name}.webp" "$ptime" "1280"
    title="$name"; subtitle=""
    if [ -f "$d/label.txt" ]; then
      title="$(sed -n '1p' "$d/label.txt")"; subtitle="$(sed -n '2p' "$d/label.txt")"
    fi
    [ $first -eq 1 ] && first=0 || CMP_JSON+=","
    CMP_JSON+="{\"name\":$(jesc "$name"),\"title\":$(jesc "$title"),\"subtitle\":$(jesc "$subtitle"),\"full\":$(jesc "static/videos/comparisons/${name}_full.mp4"),\"veda\":$(jesc "static/videos/comparisons/${name}_veda.mp4"),\"poster\":$(jesc "static/posters/comparisons/${name}.webp")}"
  done
fi
CMP_JSON+="]"

echo "==> Processing gallery"
GAL_JSON="["
first=1
if [ -d "$ASSETS/gallery" ]; then
  for f in "$ASSETS"/gallery/*.mp4; do
    [ -f "$f" ] || continue
    name="$(basename "$f" .mp4)"
    echo "  - $name"
    gallery_tile "$f" "$OUT_VID/gallery/${name}_tile.mp4"
    gallery_full "$f" "$OUT_VID/gallery/${name}.mp4"
    poster_webp  "$f" "$OUT_POS/gallery/${name}.webp" "$GAL_START" "${GAL_TILE_W:-360}"
    cap=""
    [ -f "$ASSETS/gallery/${name}.txt" ] && cap="$(sed -n '1p' "$ASSETS/gallery/${name}.txt")"
    [ $first -eq 1 ] && first=0 || GAL_JSON+=","
    GAL_JSON+="{\"name\":$(jesc "$name"),\"caption\":$(jesc "$cap"),\"tile\":$(jesc "static/videos/gallery/${name}_tile.mp4"),\"mp4\":$(jesc "static/videos/gallery/${name}.mp4"),\"poster\":$(jesc "static/posters/gallery/${name}.webp")}"
  done
fi
GAL_JSON+="]"

echo "==> Writing manifest -> $OUT_JS"
{
  echo "// AUTO-GENERATED by scripts/process_media.sh — do not edit by hand."
  echo "window.__VEDA_MEDIA__ = {"
  echo "  comparisons: $CMP_JSON,"
  echo "  gallery: $GAL_JSON"
  echo "};"
} > "$OUT_JS"

echo "==> Done."
echo "    comparisons: $(echo "$CMP_JSON" | grep -o '"name"' | wc -l | tr -d ' ')"
echo "    gallery:     $(echo "$GAL_JSON" | grep -o '"name"' | wc -l | tr -d ' ')"
du -sh "$OUT_VID" "$OUT_POS" 2>/dev/null || true
