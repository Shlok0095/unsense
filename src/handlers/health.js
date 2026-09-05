import { hasToken, hasNvidiaKey, hasOllama, getModelConfig } from "../config.js";
import { CONTEXT_WINDOW_MESSAGES } from "../prompts/index.js";
import { getHealthSnapshot } from "../models/health.js";
import { listTools } from "../tools/index.js";

export function handleHealth(_req, res) {
  return res.status(200).json({
    ok: true,
    hasToken: hasToken(),
    hasNvidiaKey: hasNvidiaKey(),
    hasOllama: hasOllama(),
    fileUpload: true, // text-layer PDFs/Office files work without any key; images need NVIDIA_API_KEY
    contextWindow: CONTEXT_WINDOW_MESSAGES,
    models: getModelConfig(),
    modelHealth: getHealthSnapshot(),
    tools: listTools().map((t) => t.name),
  });
}
