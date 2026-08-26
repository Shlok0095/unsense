import { getToken, hasToken } from "./config.js";
import { runChat } from "./agent.js";
import { CONTEXT_WINDOW_MESSAGES } from "./prompts.js";

const routes = {
  get: new Map(),
  post: new Map(),
};

routes.get.set("/health", (_req, res) => {
  res.json({
    ok: true,
    hasToken: hasToken(),
    contextWindow: CONTEXT_WINDOW_MESSAGES,
  });
});

routes.post.set("/chat", async (req, res) => {
  const token = getToken();
  if (!token) {
    return res.status(503).json({
      error: "HF_TOKEN is not configured on the server.",
    });
  }

  const { message, history = [] } = req.body ?? {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "History must be an array." });
  }

  const userText = message.trim();
  const safeHistory = history
    .filter(
      (entry) =>
        entry &&
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string"
    )
    .map(({ role, content }) => ({ role, content }));

  try {
    const result = await runChat({
      token,
      userMessage: userText,
      history: [...safeHistory, { role: "user", content: userText }],
    });

    res.json({
      id: result.id || `msg_${Date.now()}`,
      role: result.role,
      content: result.content,
      finishReason: result.finishReason,
      usage: result.usage,
      webSearch: result.webSearch,
    });
  } catch (error) {
    res.status(error.status || 502).json({
      error: error.message || "Failed to reach Hugging Face router.",
    });
  }
});

export function createApiRouter() {
  return routes;
}
