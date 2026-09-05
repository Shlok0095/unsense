/**
 * Orchestrator-driven tool selection.
 *
 * The models this app talks to through the HF Router (open Llama-family
 * checkpoints via Featherless) don't reliably support OpenAI-style
 * function-calling, so tool use here is orchestrator-decided via cheap,
 * deterministic heuristics rather than a model-driven tool-call loop. Each
 * tool is still a real registry entry (src/tools) with its own schema and
 * handler — so if a tool-calling-capable model/provider is added later, the
 * same registry can be exposed as function definitions without touching the
 * tools themselves. This function is the one seam that would change.
 */
import { runTool } from "../tools/index.js";

const URL_RE = /https?:\/\/[^\s<>()]+/i;
const TIME_RE = /\b(what(?:'s| is) (?:the )?(?:current )?(?:time|date)|current time|current date|today'?s date)\b/i;
const MATH_RE = /^[\d\s+\-*/^().]+$/;

/**
 * @returns {{ timeResult: object|null, calcResult: object|null, urlResult: object|null, skipWebSearch: boolean }}
 */
export async function planDeterministicTools(message) {
  const text = message.trim();
  let timeResult = null;
  let calcResult = null;
  let urlResult = null;

  if (TIME_RE.test(text)) {
    const outcome = await runTool("time", {});
    if (outcome.ok) timeResult = outcome.result;
  }

  if (MATH_RE.test(text) && /[+\-*/^]/.test(text) && text.replace(/\s/g, "").length > 2) {
    const outcome = await runTool("calculator", { expression: text });
    if (outcome.ok) calcResult = outcome.result;
  }

  const urlMatch = text.match(URL_RE);
  if (urlMatch) {
    const outcome = await runTool("fetch_url", { url: urlMatch[0] });
    if (outcome.ok) urlResult = outcome.result;
  }

  return {
    timeResult,
    calcResult,
    urlResult,
    // If we already answered the "what time/date is it" question locally,
    // there's no need to burn a web search on it too.
    skipWebSearch: Boolean(timeResult),
  };
}

export function formatToolContext({ timeResult, calcResult, urlResult }) {
  const parts = [];
  if (timeResult) {
    parts.push(`Current date/time (${timeResult.timezone}): ${timeResult.formatted}`);
  }
  if (calcResult) {
    parts.push(`Calculator result for "${calcResult.expression}": ${calcResult.value}`);
  }
  if (urlResult) {
    parts.push(`Content fetched from ${urlResult.url}:\n${urlResult.excerpt}`);
  }
  return parts.join("\n\n");
}
