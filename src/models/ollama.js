/**
 * Optional local/private provider adapter for Ollama (https://ollama.com).
 * Entirely opt-in: only used when OLLAMA_BASE_URL is configured (see
 * src/config.js) and the user selects the "local" privacy mode. Modern
 * Ollama exposes an OpenAI-compatible endpoint, so this reuses the same
 * shared client as the Hugging Face adapter.
 */
import { callChatCompletion, streamChatCompletion } from "./openaiCompatClient.js";
import { getOllamaBaseUrl } from "../config.js";

export const PROVIDER_NAME = "ollama";
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

function endpoint() {
  const base = getOllamaBaseUrl();
  if (!base) {
    throw new Error(
      "Ollama is not configured. Set OLLAMA_BASE_URL to use local/private mode."
    );
  }
  return `${base}/v1/chat/completions`;
}

export async function chatCompletion({
  model,
  messages,
  max_tokens = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = 0.8,
  signal,
  generationProfile = "fast",
}) {
  return callChatCompletion({
    url: endpoint(),
    headers: {},
    providerName: PROVIDER_NAME,
    model,
    messages,
    max_tokens,
    temperature,
    signal,
    generationProfile,
  });
}

export async function* chatCompletionStream({
  model,
  messages,
  max_tokens = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = 0.75,
  signal,
  generationProfile = "fast",
}) {
  yield* streamChatCompletion({
    url: endpoint(),
    headers: {},
    providerName: PROVIDER_NAME,
    model,
    messages,
    max_tokens,
    temperature,
    signal,
    generationProfile,
  });
}
