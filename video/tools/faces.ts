import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Generates the film's contact portraits with an image model through
 * OpenRouter — fictional people, so no real person's photo is used. Writes
 * public/faces/<id>.png. Reads OPENROUTER_API_KEY from the app's .env.local
 * and never prints it.
 *
 *   bun run tools/faces.ts [model]
 */

const model = process.argv[2] ?? "google/gemini-3.1-flash-image";
const env = readFileSync(path.resolve("../.env.local"), "utf8");
const key = env.match(/^OPENROUTER_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) throw new Error("OPENROUTER_API_KEY is not set in ../.env.local");

const STYLE =
  "Professional LinkedIn-style headshot photo of a fictional person (not a real or famous person). Square crop, head and shoulders, centred, looking at the camera with a friendly natural smile, soft even studio light, plain light grey background, business casual clothes, sharp focus, realistic photo.";

const PEOPLE: Record<string, string> = {
  maya: "East Asian woman in her early 30s, shoulder-length black hair, navy blazer",
  daniel: "Black man in his late 30s, short hair and trimmed beard, light blue shirt",
  priya: "South Asian woman in her early 30s, long dark hair, cream blouse",
  lucas: "White man in his mid 40s, short light-brown hair, grey quarter-zip sweater",
  sofia: "Latina woman in her late 30s, wavy brown hair, black blazer",
  omar: "Middle Eastern man in his early 30s, short dark hair, white shirt",
};

const outDir = path.resolve("public/faces");
mkdirSync(outDir, { recursive: true });

for (const [id, who] of Object.entries(PEOPLE)) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, modalities: ["image", "text"], messages: [{ role: "user", content: `${STYLE} Subject: ${who}.` }] }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${id}: OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  const json = JSON.parse(body) as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[] };
  const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const m = url?.match(/^data:image\/(\w+);base64,(.*)$/s);
  if (!m) throw new Error(`${id}: no image in the response: ${body.slice(0, 300)}`);
  const file = path.join(outDir, `${id}.${m[1] === "jpeg" ? "jpg" : m[1]}`);
  writeFileSync(file, Buffer.from(m[2], "base64"));
  console.log(`face ${id} → ${path.basename(file)}`);
}
