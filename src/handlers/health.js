import { hasToken, hasNvidiaKey } from "../config.js";
import { CONTEXT_WINDOW_MESSAGES } from "../prompts.js";

export function handleHealth(_req, res) {
  return res.status(200).json({
    ok: true,
    hasToken: hasToken(),
    hasNvidiaKey: hasNvidiaKey(),
    fileUpload: hasNvidiaKey(),
    contextWindow: CONTEXT_WINDOW_MESSAGES,
  });
}
