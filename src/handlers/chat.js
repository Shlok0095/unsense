import { getToken } from "../config.js";
import { runChat } from "../agent.js";

export async function handleChat(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const token = getToken();
  if (!token) {
    return res.status(503).json({
      error: "HF_TOKEN is not configured on the server.",
    });
  }

  const { message, history = [], attachmentContext = "" } = req.body ?? {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "History must be an array." });
  }

  const userText = message.trim();
  const attachmentPrefix =
    typeof attachmentContext === "string" ? attachmentContext.trim() : "";
  const composedUserText = attachmentPrefix
    ? `${attachmentPrefix}User question:\n${userText}`
    : userText;

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
      userMessage: composedUserText,
      history: [...safeHistory, { role: "user", content: composedUserText }],
    });

    return res.status(200).json({
      id: result.id || `msg_${Date.now()}`,
      role: result.role,
      content: result.content,
      finishReason: result.finishReason,
      usage: result.usage,
      webSearch: result.webSearch,
    });
  } catch (error) {
    const status = error.status || 502;
    const message = error.message || "Failed to reach Hugging Face router.";
    console.error("[chat]", status, message, error.details || "");
    return res.status(status).json({ error: message });
  }
}
