/**
 * Resolves the effective response mode when the user enables Think.
 * Default (think off) is always fast — no model call spent.
 */
import { classifyByHeuristics } from "./modeHeuristics.js";
import { generate } from "../models/gateway.js";
import { validateMode } from "../security/validation.js";

const CLASSIFY_PROMPT = `Classify the user's question into exactly one response mode.
Reply with exactly one word: FAST, THINK, RESEARCH, ANALYZE, or CODE.

FAST — simple greetings, short factual questions, casual chat.
THINK — complex reasoning, multi-step explanations, tradeoffs, deep analysis of ideas.
RESEARCH — current events, live data, recent news, prices, scores, up-to-date facts.
ANALYZE — document/file analysis, summarizing uploaded content, comparing reports.
CODE — programming, debugging, implementation, algorithms, technical architecture.`;

const MODE_LABELS = {
  fast: "Responding...",
  think: "Thinking deeply...",
  research: "Researching...",
  analyze: "Analyzing...",
  code: "Coding...",
};

function parseModeWord(text) {
  const word = String(text || "").trim().toUpperCase();
  const map = {
    FAST: "fast",
    THINK: "think",
    RESEARCH: "research",
    ANALYZE: "analyze",
    CODE: "code",
  };
  for (const [key, mode] of Object.entries(map)) {
    if (word.startsWith(key) || word.includes(key)) return mode;
  }
  const match = word.match(/\b(FAST|THINK|RESEARCH|ANALYZE|CODE)\b/);
  return match ? map[match[1]] : null;
}

export function modeStatusLabel(mode) {
  return MODE_LABELS[mode] || MODE_LABELS.think;
}

/**
 * @returns {Promise<{ mode: string }>}
 */
export async function resolveResponseMode({
  think = false,
  message,
  documentChunks = [],
  token,
  privacyMode = "normal",
}) {
  if (!think) return { mode: "fast" };

  const hasDocuments = documentChunks.length > 0;
  const heuristic = classifyByHeuristics(message, { hasDocuments });
  if (heuristic?.confidence === "high") {
    return { mode: validateMode(heuristic.mode) };
  }

  if (privacyMode === "local" && !token) {
    return { mode: heuristic?.mode ? validateMode(heuristic.mode) : "think" };
  }

  try {
    const result = await generate({
      token,
      mode: "fast",
      privacyMode,
      messages: [
        { role: "system", content: CLASSIFY_PROMPT },
        { role: "user", content: message.trim() },
      ],
      temperature: 0,
      maxTokens: 8,
    });
    const parsed = parseModeWord(result.content);
    return { mode: validateMode(parsed || heuristic?.mode || "think") };
  } catch (error) {
    console.warn("[modeResolver] classification failed:", error.message);
    return { mode: validateMode(heuristic?.mode || "think") };
  }
}
