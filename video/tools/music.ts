import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Generates the film's score with Google Lyria 3 through OpenRouter and
 * saves it under video/public/. The key is read from the app's .env.local
 * (OPENROUTER_API_KEY) and never printed.
 *
 *   bun run tools/music.ts <out-basename> [model] < prompt.txt
 */

const [name = "music", model = "google/lyria-3-pro-preview"] = process.argv.slice(2);
const prompt = readFileSync(0, "utf8").trim();
if (!prompt) throw new Error("Pass the prompt on stdin.");

const env = readFileSync(path.resolve("../.env.local"), "utf8");
const key = env.match(/^OPENROUTER_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) throw new Error("OPENROUTER_API_KEY is not set in ../.env.local");

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model, stream: true, modalities: ["audio", "text"], messages: [{ role: "user", content: prompt }] }),
});
if (!res.ok || !res.body) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 600)}`);

// Server-sent events: audio arrives as base64 pieces in choices[].delta.audio.data.
type Json = Record<string, unknown>;
const pieces: string[] = [];
let format: string | undefined;
let text = "";
const seen = new Set<string>();
const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
  buffer += decoder.decode(chunk, { stream: true });
  let nl: number;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") continue;
    const event = JSON.parse(data) as Json;
    if (event.error) throw new Error(`OpenRouter: ${JSON.stringify(event.error).slice(0, 400)}`);
    const delta = ((event.choices as Json[] | undefined)?.[0]?.delta ?? {}) as Json;
    for (const k of Object.keys(delta)) seen.add(k);
    const audio = delta.audio as Json | undefined;
    if (audio) {
      if (typeof audio.data === "string") pieces.push(audio.data);
      if (typeof audio.format === "string") format = audio.format;
      for (const k of Object.keys(audio)) seen.add(`audio.${k}`);
    }
    if (typeof delta.content === "string") text += delta.content;
  }
}
console.log("delta keys:", [...seen].join(", "));
if (text) console.log("text:", text.slice(0, 500));
if (pieces.length === 0) throw new Error("No audio in the stream.");
const buf = Buffer.concat(pieces.map((p) => Buffer.from(p, "base64")));
const head = buf.subarray(0, 4).toString("latin1");
const ext = format && format !== "pcm16" ? format : head === "RIFF" ? "wav" : head.startsWith("ID3") || buf[0] === 0xff ? "mp3" : "raw";
const file = path.resolve("public", `${name}.${ext}`);
writeFileSync(file, buf);
console.log(`saved ${file} (${(buf.length / 1024).toFixed(0)} KB, ${pieces.length} chunks, format ${format ?? "?"}, head ${JSON.stringify(head)})`);
