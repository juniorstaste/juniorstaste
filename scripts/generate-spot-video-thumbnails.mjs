import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "spot-images";
const THUMBNAIL_DIRECTORY = "video-thumbnails";
const FRAME_TIME_SECONDS = "1.5";

async function loadLocalEnvironment() {
  const contents = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1).replace(/^['\"]|['\"]$/g, "");
    process.env[key] ??= value;
  }
}

async function runFfmpeg(videoUrl, outputPath) {
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-ss", FRAME_TIME_SECONDS,
      "-i", videoUrl,
      "-frames:v", "1",
      "-vf", "scale=720:-2",
      "-q:v", "3",
      "-y", outputPath,
    ], { stdio: "inherit" });
    ffmpeg.once("error", reject);
    ffmpeg.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)));
  });
}

await loadLocalEnvironment();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !secretKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");

try {
  await access("/usr/local/bin/ffmpeg");
} catch {
  try {
    await access("/opt/homebrew/bin/ffmpeg");
    process.env.PATH = `/opt/homebrew/bin:${process.env.PATH ?? ""}`;
  } catch {
    // Let spawn provide the platform-specific error when ffmpeg is not on PATH.
  }
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: spots, error } = await supabase
  .from("spots")
  .select("id, name, video_url")
  .not("video_url", "is", null)
  .order("created_at", { ascending: true });
if (error) throw error;

const workingDirectory = await mkdtemp(join(tmpdir(), "juniorstaste-thumbnails-"));
try {
  for (const spot of spots ?? []) {
    if (!spot.video_url?.trim()) continue;
    const objectPath = `${THUMBNAIL_DIRECTORY}/${spot.id}.jpg`;
    const { data: existing } = await supabase.storage.from(BUCKET).list(THUMBNAIL_DIRECTORY, {
      search: `${spot.id}.jpg`,
      limit: 1,
    });
    if (existing?.some((object) => object.name === `${spot.id}.jpg`)) {
      console.log(`skip: ${spot.name}`);
      continue;
    }

    const outputPath = join(workingDirectory, `${spot.id}.jpg`);
    console.log(`create: ${spot.name}`);
    await runFfmpeg(spot.video_url, outputPath);
    const thumbnail = await readFile(outputPath);
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, thumbnail, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;
  }
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
}
