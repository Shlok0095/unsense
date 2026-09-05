/**
 * The orchestrator: the actual pipeline described in the architecture docs —
 * intent → context → tools → retrieval → model → validation → citations →
 * follow-ups — implemented as a single async generator so the handler can
 * forward each step straight out over SSE as it happens.
 *
 * Yields (all consumed by src/handlers/chat.js):
 *   { type: "status", label }                     progress for the UI
 *   { type: "sources", sources }                   verified web sources, as soon as search completes
 *   { type: "delta", text }                        streamed answer text
 *   { type: "done", ...finalMetadata }             exactly once, last
 *   { type: "error", error }                       terminal — stream ends
 */
import { decideWebSearch } from "./intent.js";
import { planDeterministicTools, formatToolContext } from "./toolPlanner.js";
import { windowHistory, assembleContextEnvelope } from "./contextManager.js";
import { buildSystemPrompt } from "../prompts/index.js";
import { wrapUntrustedContent } from "../prompts/injectionGuard.js";
import { generateStream } from "../models/gateway.js";
import { DEFAULT_MAX_OUTPUT_TOKENS } from "../models/hf.js";
import { sanitizeMessages, sanitizeAssistantOutput } from "../models/outputSanitizer.js";
import { generateFollowups } from "./followups.js";
import { searchWeb } from "../search/index.js";
import { formatSearchContext } from "../search/citations.js";
import { retrieve } from "../rag/retriever.js";
import { formatDocumentContext } from "../files/format.js";
import { formatMemoryContext } from "../memory/format.js";

const MODE_TEMPERATURE = {
  fast: 0.75,
  think: 0.55,
  research: 0.6,
  analyze: 0.6,
  code: 0.4,
};

const MODE_MAX_TOKENS = {
  fast: 2048,
  think: 4096,
  research: 4096,
  analyze: 4096,
  code: 4096,
};

export async function* runOrchestration({
  token,
  privacyMode = "normal",
  mode = "fast",
  thinkRequested = false,
  userMessage,
  history = [],
  existingSummary = null,
  documentChunks = [],
  memoryItems = [],
  memoryEnabled = false,
  webSearchEnabled = true,
  signal,
}) {
  const toolPlan = await planDeterministicTools(userMessage);

  // --- Web search (freshness) ---
  let sources = [];
  let webContext = "";
  if (!toolPlan.skipWebSearch && webSearchEnabled) {
    const { needsWeb, query } = await decideWebSearch({
      token,
      message: userMessage,
      mode,
      privacyMode,
      webSearchEnabled,
    });
    if (needsWeb) {
      yield { type: "status", label: "Searching sources..." };
      try {
        const searchData = await searchWeb(query);
        sources = searchData.results;
        if (sources.length) {
          webContext = formatSearchContext(searchData.query, sources);
          yield { type: "sources", sources };
        } else {
          webContext = formatSearchContext(searchData.query, []);
        }
      } catch (error) {
        console.warn("[orchestrator] web search failed:", error.message);
      }
    }
  }

  // --- Uploaded documents (RAG) ---
  let documentContext = "";
  if (documentChunks.length) {
    yield { type: "status", label: "Reading uploaded files..." };
    const { results } = retrieve(userMessage, documentChunks, { topK: 6 });
    documentContext = formatDocumentContext(results);
  }

  // --- Long-term memory ---
  let memoryContext = "";
  if (memoryEnabled && memoryItems.length) {
    const asChunks = memoryItems.map((m) => ({ chunkId: m.id, text: m.text }));
    const { results } = retrieve(userMessage, asChunks, { topK: 5 });
    memoryContext = formatMemoryContext(results);
  }

  // --- Deterministic tools (time/calculator/url-fetch) ---
  const toolContextText = formatToolContext(toolPlan);
  const toolContextBlock = toolContextText
    ? wrapUntrustedContent("tool", "deterministic tool output", toolContextText)
    : "";

  // --- Context window + summarization ---
  const { recentHistory, summary, summarizedCount } = await windowHistory({
    token,
    mode,
    privacyMode,
    history,
    existingSummary,
    signal,
  });

  const envelope = assembleContextEnvelope({
    summary,
    memoryBlock: [toolContextBlock, memoryContext].filter(Boolean).join("\n\n"),
    documentBlock: documentContext,
    webBlock: webContext,
  });

  const finalUserContent = envelope
    ? `${envelope}\n\nUser question:\n${userMessage}`
    : userMessage;

  const messages = sanitizeMessages([
    { role: "system", content: buildSystemPrompt(mode) },
    ...recentHistory.map(({ role, content }) => ({ role, content })),
    { role: "user", content: finalUserContent },
  ]);

  // --- Generation ---
  yield { type: "status", label: "Generating answer..." };

  let fullContent = "";
  let finalMeta = null;

  const stream = generateStream({
    token,
    mode,
    privacyMode,
    messages,
    temperature: MODE_TEMPERATURE[mode] ?? 0.75,
    maxTokens: MODE_MAX_TOKENS[mode] ?? DEFAULT_MAX_OUTPUT_TOKENS,
    signal,
  });

  for await (const event of stream) {
    if (event.type === "delta") {
      fullContent += event.text;
      yield event;
    } else if (event.type === "done") {
      finalMeta = event;
      if (event.content) fullContent = event.content;
    } else if (event.type === "error") {
      yield event;
      return;
    }
  }

  fullContent = sanitizeAssistantOutput(fullContent);

  // --- Response validation ---
  if (!fullContent.trim()) {
    fullContent =
      "I wasn't able to generate a response for that. Try again, or switch to a different mode or model.";
    yield { type: "delta", text: fullContent };
  }

  // --- Follow-up suggestions ---
  const followups = await generateFollowups({
    token,
    privacyMode,
    userMessage,
    assistantContent: fullContent,
  });

  yield {
    type: "done",
    content: fullContent,
    finishReason: finalMeta?.finishReason || "stop",
    usage: finalMeta?.usage || null,
    provider: finalMeta?.provider || null,
    model: finalMeta?.model || null,
    usedFallback: Boolean(finalMeta?.usedFallback),
    sources,
    followups,
    contextSummary: summary,
    summarizedCount,
    mode,
    thinkUsed: thinkRequested,
  };
}
