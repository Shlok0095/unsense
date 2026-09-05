/**
 * Provider-independent model gateway. Everything else in the app calls
 * generate()/generateStream() — never a specific provider's client — so
 * swapping or adding a provider never touches calling code.
 *
 * Handles: model routing (via modelRouter), automatic fallback to a
 * secondary model/provider on failure, and health-aware skipping of a
 * model that just failed repeatedly.
 */
import * as hf from "./hf.js";
import * as ollama from "./ollama.js";
import { shouldFallback } from "./fallback.js";
import { isHealthy } from "./health.js";
import { routeModel } from "./modelRouter.js";

const PROVIDERS = { hf, ollama };

function adapterFor(provider) {
  const adapter = PROVIDERS[provider];
  if (!adapter) throw new Error(`Unknown model provider: ${provider}`);
  return adapter;
}

/**
 * Non-streaming completion with automatic fallback.
 */
export async function generate({
  token,
  mode = "fast",
  privacyMode = "normal",
  messages,
  temperature = 0.75,
  maxTokens,
  signal,
}) {
  const { primary, fallback } = routeModel({ mode, privacyMode });
  const attempts = [primary, fallback].filter(Boolean);

  let lastError = null;
  for (let i = 0; i < attempts.length; i++) {
    const { provider, model } = attempts[i];
    if (!isHealthy(provider, model) && i < attempts.length - 1) {
      continue; // skip a model in cooldown if we still have another option
    }
    try {
      const adapter = adapterFor(provider);
      const result = await adapter.chatCompletion({
        token,
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        signal,
      });
      return { ...result, provider, model, usedFallback: i > 0 };
    } catch (error) {
      lastError = error;
      if (i < attempts.length - 1 && shouldFallback(error)) continue;
      throw error;
    }
  }
  throw lastError || new Error("No model provider available.");
}

/**
 * Streaming completion with automatic fallback — but only before the first
 * token has been sent. Once content has started streaming to the user,
 * switching models mid-answer would be more confusing than a clean error,
 * so a mid-stream failure is surfaced as an "error" event instead.
 *
 * Yields the same event shapes as the provider adapters:
 *   { type: "delta", text }
 *   { type: "done", content, finishReason, usage, id, provider, model, usedFallback }
 *   { type: "error", error }
 */
export async function* generateStream({
  token,
  mode = "fast",
  privacyMode = "normal",
  messages,
  temperature = 0.75,
  maxTokens,
  signal,
}) {
  const { primary, fallback } = routeModel({ mode, privacyMode });
  const attempts = [primary, fallback].filter(Boolean);

  let lastError = null;

  for (let i = 0; i < attempts.length; i++) {
    const { provider, model } = attempts[i];
    if (!isHealthy(provider, model) && i < attempts.length - 1) continue;

    const adapter = adapterFor(provider);
    const stream = adapter.chatCompletionStream({
      token,
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      signal,
    });

    let startedStreaming = false;

    for await (const event of stream) {
      if (event.type === "delta") {
        startedStreaming = true;
        yield event;
      } else if (event.type === "done") {
        yield { ...event, provider, model, usedFallback: i > 0 };
        return;
      } else if (event.type === "error") {
        lastError = event.error;
        if (!startedStreaming && i < attempts.length - 1 && shouldFallback(event.error)) {
          break; // try the next model
        }
        yield event;
        return;
      }
    }
  }

  if (lastError) yield { type: "error", error: lastError };
}
