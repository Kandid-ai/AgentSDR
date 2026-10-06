import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";

/**
 * Trims a render's audio to the video's exact length. Remotion's AAC track
 * runs a few ms past the last frame, so the file outlasts its picture and
 * many players (QuickTime, browsers, social sites) show black for that
 * sliver at the very end instead of holding the end card.
 *
 *   bun run tools/finalize.ts out/final/agentsdr-launch-4k.mp4
 */
const file = process.argv[2];
if (!file) throw new Error("usage: finalize.ts <video.mp4>");

const probe = (args: string[]) => execFileSync("ffprobe", ["-v", "error", ...args, "-of", "csv=p=0", file]).toString().trim();
const video = Number(probe(["-select_streams", "v:0", "-show_entries", "stream=duration"]));
const tmp = file.replace(/\.mp4$/, ".tmp.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy", "-af", `atrim=end=${video},asetpts=PTS-STARTPTS`, "-c:a", "aac", "-b:a", "320k", "-t", String(video), "-movflags", "+faststart", tmp]);
renameSync(tmp, file);
console.log(`${file}: video ${video}s, file ${probe(["-show_entries", "format=duration"])}s, audio ${probe(["-select_streams", "a:0", "-show_entries", "stream=duration"])}s`);
