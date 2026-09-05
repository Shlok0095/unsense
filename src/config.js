import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getPublicDir() {
  return path.resolve(__dirname, "..", "public");
}

// ---- Hugging Face (primary provider) ----
export function getToken() {
  return process.env.HF_TOKEN || "";
}

export function hasToken() {
  return Boolean(getToken());
}

// Model tiers are configurable via env so the app is never hard-coded to one
// specific model. Sensible free-tier defaults are used when unset.
export function getModelConfig() {
  const primary =
    process.env.HF_PRIMARY_MODEL ||
    "Orenguteng/Llama-3.1-8B-Lexi-Uncensored-V2:featherless-ai";
  const fallback =
    process.env.HF_FALLBACK_MODEL ||
    "NousResearch/Hermes-3-Llama-3.1-70B:featherless-ai";
  return {
    // fast / everyday chat
    fast: primary,
    // deep reasoning / research / analysis — falls back to the same
    // stronger model unless a dedicated one is configured
    deep: process.env.HF_DEEP_MODEL || fallback,
    // coding — falls back to the deep-tier model unless a dedicated
    // coding model is configured
    code: process.env.HF_CODE_MODEL || process.env.HF_DEEP_MODEL || fallback,
    // used only as the last-resort fallback when the requested tier fails
    fallback,
  };
}

// ---- NVIDIA (vision / OCR) ----
export function getNvidiaKey() {
  return process.env.NVIDIA_API_KEY || "";
}

export function hasNvidiaKey() {
  return Boolean(getNvidiaKey());
}

// ---- Ollama (optional local/private provider) ----
// Entirely optional. When unset, the Ollama adapter is simply skipped by the
// model router/gateway — no error, no requirement to configure it.
export function getOllamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || "").replace(/\/+$/, "");
}

export function hasOllama() {
  return Boolean(getOllamaBaseUrl());
}

export function getOllamaModel() {
  return process.env.OLLAMA_MODEL || "llama3.1";
}

// ---- Server ----
export function getPort() {
  return Number(process.env.PORT) || 3000;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
