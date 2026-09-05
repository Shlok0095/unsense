/**
 * Context budgeting and assembly.
 *
 * Because the backend is stateless (no server-side conversation store —
 * see README/WORKFLOW for why), summarization state has to live on the
 * client. The contract: the client sends `history` containing only the
 * messages *not yet covered* by `conversationSummary`. When `history` grows
 * past CONTEXT_WINDOW_MESSAGES, this module folds the oldest overflow into
 * an updated summary and reports back `summarizedCount` so the client knows
 * how many messages it can now stop re-sending (it still keeps them in
 * localStorage for display — only the wire payload shrinks).
 *
 * Priority when trimming to fit the token budget (highest first, per the
 * product spec): current request > immediate conversation > memory >
 * files > web evidence > older summary. Trimming removes from the bottom
 * of that list first.
 */
import { generate } from "../models/gateway.js";
import { CONTEXT_WINDOW_MESSAGES } from "../prompts/index.js";

const TOKEN_BUDGET = Number(process.env.CONTEXT_TOKEN_BUDGET) || 6000;

export function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

const SUMMARIZER_SYSTEM = `You compress conversation history into a short factual summary for later
context. Output only concise bullet points (3-8 max) covering durable facts,
decisions, and unresolved questions. No preamble, no commentary.`;

async function extendSummary({ token, mode, privacyMode, existingSummary, agedOutMessages, signal }) {
  if (!agedOutMessages.length) return existingSummary || null;

  const transcript = agedOutMessages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const prompt = `Existing summary (may be empty):\n${existingSummary || "(none)"}\n\nNew conversation to fold in:\n${transcript}`;

  try {
    const result = await generate({
      token,
      mode: "fast",
      privacyMode,
      signal,
      messages: [
        { role: "system", content: SUMMARIZER_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      maxTokens: 400,
    });
    return result.content.trim();
  } catch (error) {
    console.warn("[context] summarization failed, keeping prior summary:", error.message);
    return existingSummary || null;
  }
}

/**
 * @returns {{ recentHistory, summary, summarizedCount }}
 */
export async function windowHistory({ token, mode, privacyMode, history, existingSummary, signal }) {
  if (history.length <= CONTEXT_WINDOW_MESSAGES) {
    return { recentHistory: history, summary: existingSummary || null, summarizedCount: 0 };
  }

  const overflowCount = history.length - CONTEXT_WINDOW_MESSAGES;
  const agedOut = history.slice(0, overflowCount);
  const recentHistory = history.slice(overflowCount);
  const summary = await extendSummary({
    token,
    mode,
    privacyMode,
    existingSummary,
    agedOutMessages: agedOut,
    signal,
  });

  return { recentHistory, summary, summarizedCount: overflowCount };
}

/**
 * Assembles the final context blocks (memory / documents / web) into a
 * single envelope prepended to the current user message, trimming in
 * lowest-priority-first order to fit the token budget.
 */
export function assembleContextEnvelope({ summary, memoryBlock, documentBlock, webBlock }) {
  const summaryBlock = summary
    ? `Summary of earlier conversation (for background context only):\n${summary}`
    : "";

  const sections = [
    { name: "web", text: webBlock || "", priority: 5 },
    { name: "document", text: documentBlock || "", priority: 4 },
    { name: "memory", text: memoryBlock || "", priority: 3 },
    { name: "summary", text: summaryBlock, priority: 6 },
  ].filter((s) => s.text);

  // Lowest priority (highest number) trimmed first.
  sections.sort((a, b) => b.priority - a.priority);

  let budget = TOKEN_BUDGET;
  const kept = [];
  for (const section of sections) {
    const cost = estimateTokens(section.text);
    if (cost <= budget || kept.length === 0) {
      kept.push(section);
      budget -= cost;
    }
    // else: drop this section entirely — budget exhausted and something
    // higher-priority already claimed it.
  }

  // Re-order kept sections back to a sensible reading order: summary first
  // (oldest context), then memory, then documents, then fresh web evidence.
  const order = { summary: 0, memory: 1, document: 2, web: 3 };
  kept.sort((a, b) => order[a.name] - order[b.name]);

  return kept.map((s) => s.text).join("\n\n");
}
