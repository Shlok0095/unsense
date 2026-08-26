/**
 * Agentic web-search decision: fast rules first, then a lightweight model check.
 */

import { shouldSearchWeb } from "./searchTriggers.js";
import { chatCompletion, PRIMARY_MODEL } from "./hfClient.js";

const SEARCH_DECISION_PROMPT = `You decide if a user question needs a live web search to answer accurately.

Reply with exactly one word: YES or NO.

Say YES for: current events, recent news, live data, prices, scores, weather, people in current roles, product releases, or any fact that may have changed after 2024.

Say NO for: greetings, creative writing, coding help, math, opinions, hypotheticals, or stable general knowledge (definitions, how things work, history before 2024).`;

const SKIP_SEARCH_PATTERNS = [
  /^(hi|hello|hey|thanks|thank you|bye|yo|sup)\b[!.?\s]*$/i,
  /^(good morning|good night|how are you)\b/i,
  /^write (me )?(a |an )?(poem|story|song|rap|joke|haiku)\b/i,
  /^help me (write|debug|fix|refactor)\b/i,
  /^(\d+(\.\d+)?\s*[\+\-\*\/\^]\s*\d+(\.\d+)?)(\s*=\s*\??)?$/,
];

export function shouldSkipSearch(message) {
  const text = message.trim();
  return SKIP_SEARCH_PATTERNS.some((pattern) => pattern.test(text));
}

function parseDecision(text) {
  const answer = String(text || "")
    .trim()
    .toUpperCase();
  if (answer.startsWith("YES")) return true;
  if (answer.startsWith("NO")) return false;
  return /\bYES\b/.test(answer);
}

export async function decideSearchWithModel({ token, userMessage }) {
  const result = await chatCompletion({
    token,
    model: PRIMARY_MODEL,
    messages: [
      { role: "system", content: SEARCH_DECISION_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 8,
    temperature: 0,
  });

  return parseDecision(result.content);
}

export async function shouldRunWebSearch({ token, userMessage }) {
  const text = userMessage.trim();
  if (!text) return false;

  if (text.startsWith("/web ")) return true;
  if (shouldSearchWeb(text, false)) return true;
  if (shouldSkipSearch(text)) return false;

  try {
    return await decideSearchWithModel({ token, userMessage: text });
  } catch (error) {
    console.warn("[search-decision] failed:", error.message);
    return false;
  }
}
