/**
 * Resolves the effective response mode when the user enables Think.
 * Default (think off) is always fast — no model call spent.
 *
 * Think mode (industry pattern): route by intent, then guarantee at least
 * "deep" tier — never classify back to fast while Think is on.
 */
import { classifyByHeuristics } from "./modeHeuristics.js";
import { generate } from "../models/gateway.js";
import { validateMode } from "../security/validation.js";

const CLASSIFY_PROMPT = `Classify the user's question into exactly one response mode.
Reply with exactly one word: THINK, RESEARCH, ANALYZE, or CODE.

THINK — complex reasoning, multi-step explanations, tradeoffs, how/why questions.
RESEARCH — current events, live data, recent news, prices, scores, up-to-date facts.
ANALYZE — document/file analysis, summarizing uploaded content, comparing reports.
CODE — programming, debugging, implementation, algorithms, technical architecture.

Do NOT reply FAST — the user explicitly enabled deep Think mode.`;

const MODE_STATUS = {
  fast: "Responding...",
  think: "Thinking deeply...",
  research: "Researching...",
  analyze: "Analyzing...",
  code: "Coding...",
};

const MODE_INTENT = {
  fast: "Quick",
  think: "Deep think",
  research: "Research",
  analyze: "Analysis",
  code: "Code",
};

function parseModeWord(text) {
  const word = String(text || "").trim().toUpperCase();
  const map = {
    THINK: "think",
    RESEARCH: "research",
    ANALYZE: "analyze",
    CODE: "code",
    FAST: "think", // never downgrade Think requests to fast
  };
  for (const [key, mode] of Object.entries(map)) {
    if (word.startsWith(key) || word.includes(key)) return mode;
  }
  const match = word.match(/\b(THINK|RESEARCH|ANALYZE|CODE)\b/);
  return match ? map[match[1]] : null;
}

/** When Think is on, never use the fast model tier. */
function applyThinkFloor(mode) {
  const clean = validateMode(mode);
  return clean === "fast" ? "think" : clean;
}

export function modeStatusLabel(mode) {
  return MODE_STATUS[mode] || MODE_STATUS.think;
}

export function modeIntentLabel(mode) {
  return MODE_INTENT[mode] || MODE_INTENT.think;
}

/**
 * @returns {Promise<{ mode: string, intent: string }>}
 */
export async function resolveResponseMode({
  think = false,
  message,
  documentChunks = [],
  token,
  privacyMode = "normal",
}) {
  if (!think) return { mode: "fast", intent: "fast" };

  const hasDocuments = documentChunks.length > 0;
  const heuristic = classifyByHeuristics(message, { hasDocuments });
  if (heuristic?.confidence === "high") {
    const mode = applyThinkFloor(heuristic.mode);
    return { mode, intent: mode };
  }

  if (privacyMode === "local" && !token) {
    const mode = applyThinkFloor(heuristic?.mode || "think");
    return { mode, intent: mode };
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
    const mode = applyThinkFloor(parsed || heuristic?.mode || "think");
    return { mode, intent: mode };
  } catch (error) {
    console.warn("[modeResolver] classification failed:", error.message);
    const mode = applyThinkFloor(heuristic?.mode || "think");
    return { mode, intent: mode };
  }
}
