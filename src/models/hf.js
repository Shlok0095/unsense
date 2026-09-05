/**
 * Hugging Face Router provider adapter (OpenAI-compatible).
 * Thin wrapper around the shared client — see openaiCompatClient.js.
 */
import { callChatCompletion, streamChatCompletion } from "./openaiCompatClient.js";

const HF_BASE_URL = "https://router.huggingface.co/v1/chat/completions";
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const PROVIDER_NAME = "hf";

export { shouldFallback } from "./fallback.js";
export { parseAssistantResponse } from "./openaiCompatClient.js";

export async function chatCompletion({
  token,
  model,
  messages,
  max_tokens = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = 0.8,
  signal,
}) {
  return callChatCompletion({
    url: HF_BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    providerName: PROVIDER_NAME,
    model,
    messages,
    max_tokens,
    temperature,
    signal,
  });
}

export async function* chatCompletionStream({
  token,
  model,
  messages,
  max_tokens = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = 0.75,
  signal,
}) {
  yield* streamChatCompletion({
    url: HF_BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    providerName: PROVIDER_NAME,
    model,
    messages,
    max_tokens,
    temperature,
    signal,
  });
}
