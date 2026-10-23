/**
 * Injected into web.whatsapp.com's own JS world by the service worker when an
 * AI-agent call is armed (chrome.scripting.executeScript, wa:load-denoiser).
 * It hands wa-hook a loader for RNNoise through DENOISER_EVENT; wa-hook runs
 * the lead's side of the call through it before the recording and Gemini.
 */
import { Rnnoise } from "@shiguredo/rnnoise-wasm";
import { DENOISER_EVENT, type DenoiserDetail } from "./wa-protocol";

const detail: DenoiserDetail = { load: () => Rnnoise.load() };
window.dispatchEvent(new CustomEvent(DENOISER_EVENT, { detail }));
