/**
 * Chooses a model tier (and fallback) for a given response mode / privacy
 * mode. This is the one place that maps "what the user asked for" onto
 * "which concrete model do we call" — nothing else in the codebase should
 * hard-code a model id.
 */
import { getModelConfig, hasOllama, getOllamaModel } from "../config.js";

const MODE_TIER = {
  fast: "fast",
  think: "deep",
  research: "deep",
  analyze: "deep",
  code: "code",
};

/**
 * @param {{ mode?: string, privacyMode?: string }} opts
 * @returns {{ primary: {provider:string, model:string}, fallback: {provider:string, model:string}|null }}
 */
export function routeModel({ mode = "fast", privacyMode = "normal" } = {}) {
  if (privacyMode === "local" && hasOllama()) {
    return {
      primary: { provider: "ollama", model: getOllamaModel() },
      // No cross-provider fallback in local mode — that would silently
      // send the conversation to a cloud provider, defeating the point.
      fallback: null,
    };
  }

  const models = getModelConfig();
  const tier = MODE_TIER[mode] || "fast";
  const primaryModel = models[tier] || models.fast;
  const fallbackModel = models.fallback;

  return {
    primary: { provider: "hf", model: primaryModel },
    fallback:
      fallbackModel && fallbackModel !== primaryModel
        ? { provider: "hf", model: fallbackModel }
        : null,
  };
}
