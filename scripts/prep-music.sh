#!/usr/bin/env bash
# Any song uploaded as goop*.mp4/.mp3/.m4a/.wav (repo root or docs/) becomes docs/<name>.ogg + .mp3,
# with silence trimmed off the start and end so it loops straight into the next song.
shopt -s nullglob nocaseglob
for src in goop*.mp4 goop*.mp3 goop*.m4a goop*.wav docs/goop*.mp4 docs/goop*.m4a docs/goop*.wav; do
  name=$(basename "${src%.*}" | tr '[:upper:]' '[:lower:]')
  out=docs/$name
  [ -f "$out.ogg" ] && continue   # each song is converted once; delete docs/<name>.ogg to redo it
  echo "Preparing song $src -> $out.ogg/.mp3"
  trim="silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
  ffmpeg -v error -y -i "$src" -vn -af "$trim" -c:a libopus -b:a 96k "$out.ogg" &&
  ffmpeg -v error -y -i "$src" -vn -af "$trim" -c:a libmp3lame -b:a 160k "$out.mp3" || echo "could not convert $src"
done
