/**
 * Decides whether a message needs a live web search. Response *mode*
 * (fast/think/research/analyze/code) is chosen explicitly by the user in
 * the UI and maps directly to intent/structure/model tier (see
 * prompts/modes.js and models/modelRouter.js) — there's no need to spend a
 * model call re-classifying something the user already told us. Freshness
 * is different: it genuinely varies message-to-message regardless of mode,
 * so it gets its own cheap decision here.
 */
import {
  isForcedSearch,
  extractForcedSearchQuery,
  matchesWebTrigger,
  matchesSkipSearch,
} from "./intentHeuristics.js";
import { generate } from "../models/gateway.js";

const DECISION_PROMPT = `You decide if a user question needs a live web search to answer accurately.
Reply with exactly one word: YES or NO.
Say YES for: current events, recent news, live data, prices, scores, weather, people in current roles, product releases, or any fact that may have changed recently.
Say NO for: greetings, creative writing, coding help, math, opinions, hypotheticals, or stable general knowledge.`;

function parseYesNo(text) {
  const answer = String(text || "").trim().toUpperCase();
  if (answer.startsWith("YES")) return true;
  if (answer.startsWith("NO")) return false;
  return /\bYES\b/.test(answer);
}

/**
 * @returns {{ needsWeb: boolean, query: string }}
 */
export async function decideWebSearch({ token, message, mode, privacyMode, webSearchEnabled = true }) {
  const text = message.trim();
  if (!text) return { needsWeb: false, query: "" };
  if (!webSearchEnabled) return { needsWeb: false, query: text };

  if (isForcedSearch(text)) {
    return { needsWeb: true, query: extractForcedSearchQuery(text) };
  }
  if (mode === "research") {
    return { needsWeb: true, query: text };
  }
  if (matchesWebTrigger(text)) {
    return { needsWeb: true, query: text };
  }
  if (matchesSkipSearch(text)) {
    return { needsWeb: false, query: text };
  }
  if (privacyMode === "local") {
    // Keep local mode fully offline unless the heuristics above already said yes.
    return { needsWeb: false, query: text };
  }

  try {
    const result = await generate({
      token,
      mode: "fast",
      privacyMode,
      messages: [
        { role: "system", content: DECISION_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0,
      maxTokens: 8,
    });
    return { needsWeb: parseYesNo(result.content), query: text };
  } catch (error) {
    console.warn("[intent] web-search decision failed:", error.message);
    return { needsWeb: false, query: text };
  }
}
