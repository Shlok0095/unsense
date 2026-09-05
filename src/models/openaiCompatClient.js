/**
 * Shared client for any OpenAI-compatible `/v1/chat/completions` endpoint
 * (Hugging Face Router and Ollama's OpenAI-compat endpoint both speak this
 * dialect). Keeping the request/SSE-parsing logic in one place means adding
 * a new OpenAI-compatible provider is a ~15-line adapter, not a copy-paste.
 */
import { recordFailure, recordSuccess } from "./health.js";
import {
  CHAT_STOP_SEQUENCES,
  createStreamSanitizer,
  sanitizeAssistantOutput,
} from "./outputSanitizer.js";

function stripTemplateLeakage(text) {
  return sanitizeAssistantOutput(text);
}

const DEFAULT_FREQUENCY_PENALTY = 0.35;
const DEFAULT_PRESENCE_PENALTY = 0.1;

const GENERATION_PROFILES = {
  fast: {
    frequency_penalty: DEFAULT_FREQUENCY_PENALTY,
    presence_penalty: DEFAULT_PRESENCE_PENALTY,
  },
  deep: {
    frequency_penalty: 0.05,
    presence_penalty: 0.02,
  },
};

function buildCompletionBody({
  model,
  messages,
  max_tokens,
  temperature,
  stream,
  generationProfile = "fast",
}) {
  const penalties = GENERATION_PROFILES[generationProfile] ?? GENERATION_PROFILES.fast;
  return {
    model,
    messages,
    max_tokens,
    temperature,
    stream,
    stop: CHAT_STOP_SEQUENCES,
    frequency_penalty: penalties.frequency_penalty,
    presence_penalty: penalties.presence_penalty,
  };
}

function extractApiError(data, fallback) {
  if (!data) return fallback;
  if (typeof data.error === "string") return data.error;
  if (data.error?.message) return data.error.message;
  if (data.message) return data.message;
  return fallback;
}

export function parseAssistantResponse(choice, usageData) {
  const message = choice?.message ?? {};
  let content = stripTemplateLeakage(message.content || "");

  if (!content && message.reasoning_content) {
    content = stripTemplateLeakage(message.reasoning_content);
  } else if (!content && message.reasoning) {
    content = stripTemplateLeakage(message.reasoning);
  }

  return {
    role: "assistant",
    content: content || "(empty response)",
    finishReason: choice?.finish_reason ?? "unknown",
    usage: usageData
      ? {
          promptTokens: usageData.prompt_tokens ?? 0,
          completionTokens: usageData.completion_tokens ?? 0,
          totalTokens: usageData.total_tokens ?? 0,
        }
      : null,
  };
}

export async function callChatCompletion({
  url,
  headers,
  providerName,
  model,
  messages,
  max_tokens,
  temperature = 0.8,
  signal,
  generationProfile = "fast",
}) {
  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(
        buildCompletionBody({
          model,
          messages,
          max_tokens,
          temperature,
          stream: false,
          generationProfile,
        })
      ),
    });
  } catch (error) {
    recordFailure(providerName, model, error);
    throw error;
  }

  const raw = await upstream.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const error = new Error(raw?.slice(0, 200) || `${providerName} returned ${upstream.status}`);
    error.status = upstream.status || 502;
    recordFailure(providerName, model, error);
    throw error;
  }

  if (!upstream.ok) {
    const message = extractApiError(data, `${providerName} API error (${upstream.status})`);
    const error = new Error(message);
    error.status = upstream.status;
    error.details = data;
    recordFailure(providerName, model, error);
    throw error;
  }

  recordSuccess(providerName, model);
  const choice = data.choices?.[0];
  const parsed = parseAssistantResponse(choice, data.usage);
  return {
    ...parsed,
    usage: parsed.usage ?? {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
    id: data.id ?? null,
  };
}

export async function* streamChatCompletion({
  url,
  headers,
  providerName,
  model,
  messages,
  max_tokens,
  temperature = 0.75,
  signal,
  generationProfile = "fast",
}) {
  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(
        buildCompletionBody({
          model,
          messages,
          max_tokens,
          temperature,
          stream: true,
          generationProfile,
        })
      ),
    });
  } catch (error) {
    recordFailure(providerName, model, error);
    yield { type: "error", error };
    return;
  }

  if (!upstream.ok || !upstream.body) {
    let data = null;
    try {
      data = JSON.parse(await upstream.text());
    } catch {
      /* ignore */
    }
    const message = extractApiError(data, `${providerName} API error (${upstream.status})`);
    const error = new Error(message);
    error.status = upstream.status;
    error.details = data;
    recordFailure(providerName, model, error);
    yield { type: "error", error };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let finishReason = "unknown";
  let usage = null;
  let id = null;
  let sawAnyChunk = false;
  const sanitizer = createStreamSanitizer();
  let streamStopped = false;

  try {
    for await (const rawChunk of upstream.body) {
      buffer += decoder.decode(rawChunk, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        for (const line of frame.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;

          let json;
          try {
            json = JSON.parse(payload);
          } catch {
            continue;
          }

          id = json.id ?? id;
          if (json.usage) usage = json.usage;

          const choice = json.choices?.[0];
          if (!choice) continue;
          if (choice.finish_reason) finishReason = choice.finish_reason;

          const delta = choice.delta?.content;
          if (typeof delta === "string" && delta && !streamStopped) {
            const { text, stopped } = sanitizer.push(delta);
            if (text) {
              sawAnyChunk = true;
              fullContent += text;
              yield { type: "delta", text };
            }
            if (stopped) streamStopped = true;
          }
        }
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      recordSuccess(providerName, model); // caller-initiated stop, not a failure
      return;
    }
    recordFailure(providerName, model, error);
    yield { type: "error", error };
    return;
  }

  if (!streamStopped) {
    const { text } = sanitizer.finish();
    if (text) {
      sawAnyChunk = true;
      fullContent += text;
      yield { type: "delta", text };
    }
  }

  fullContent = sanitizeAssistantOutput(fullContent);

  if (!sawAnyChunk && !fullContent) {
    const error = new Error(`${providerName} returned an empty stream.`);
    error.status = 502;
    recordFailure(providerName, model, error);
    yield { type: "error", error };
    return;
  }

  recordSuccess(providerName, model);
  yield {
    type: "done",
    content: stripTemplateLeakage(fullContent) || "(empty response)",
    finishReason,
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        }
      : null,
    id,
  };
}
