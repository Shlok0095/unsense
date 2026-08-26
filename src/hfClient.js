export const PRIMARY_MODEL =
  "Orenguteng/Llama-3.1-8B-Lexi-Uncensored-V2:featherless-ai";
export const FALLBACK_MODEL =
  "NousResearch/Hermes-3-Llama-3.1-70B:featherless-ai";

const HF_BASE_URL = "https://router.huggingface.co/v1";
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

const MODEL_CONFIG = {
  [PRIMARY_MODEL]: { maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS },
  [FALLBACK_MODEL]: { maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS },
};

function stripTemplateLeakage(text) {
  if (!text) return "";
  let cleaned = text;
  cleaned = cleaned.split(/<\|im_start\|>/)[0];
  cleaned = cleaned.replace(/<\|im_end\|>/g, "");
  cleaned = cleaned.replace(/<\|redacted_im_end\|>/g, "");
  cleaned = cleaned.replace(/<\|eot_id\|>/g, "");
  return cleaned.trim();
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

function shouldFallback(error) {
  const status = error?.status ?? 0;
  if (status === 429 || status >= 500) return true;
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("model") ||
    message.includes("unavailable") ||
    message.includes("loading") ||
    message.includes("timeout") ||
    message.includes("rate")
  );
}

export async function chatCompletion({
  token,
  model,
  messages,
  max_tokens = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = 0.8,
}) {
  const outputLimit =
    MODEL_CONFIG[model]?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const effectiveMaxTokens = Math.min(max_tokens, outputLimit);

  const upstream = await fetch(`${HF_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: effectiveMaxTokens,
      temperature,
      stream: false,
    }),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    const message =
      data?.error?.message || data?.message || "Hugging Face API error";
    const error = new Error(message);
    error.status = upstream.status;
    error.details = data;
    throw error;
  }

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

export async function chatCompletionWithFallback({
  token,
  messages,
  max_tokens = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = 0.65,
}) {
  try {
    return await chatCompletion({
      token,
      model: PRIMARY_MODEL,
      messages,
      max_tokens,
      temperature,
    });
  } catch (primaryError) {
    if (!shouldFallback(primaryError)) {
      throw primaryError;
    }

    return await chatCompletion({
      token,
      model: FALLBACK_MODEL,
      messages,
      max_tokens,
      temperature,
    });
  }
}
