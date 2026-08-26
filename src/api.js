import multer from "multer";
import { getToken, hasToken, hasNvidiaKey, getNvidiaKey } from "./config.js";
import { runChat } from "./agent.js";
import { CONTEXT_WINDOW_MESSAGES } from "./prompts.js";
import { extractFiles, formatAttachmentContext } from "./fileExtract.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
});

const routes = {
  get: new Map(),
  post: new Map(),
};

routes.get.set("/health", (_req, res) => {
  res.json({
    ok: true,
    hasToken: hasToken(),
    hasNvidiaKey: hasNvidiaKey(),
    fileUpload: hasNvidiaKey(),
    contextWindow: CONTEXT_WINDOW_MESSAGES,
  });
});

routes.post.set("/extract-files", (req, res) => {
  upload.array("files", 5)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed." });
    }

    const nvidiaKey = getNvidiaKey();
    if (!nvidiaKey) {
      return res.status(503).json({
        error: "NVIDIA_API_KEY is not configured on the server.",
      });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    try {
      const extracts = await extractFiles(files, nvidiaKey);
      res.json({ ok: true, extracts });
    } catch (error) {
      res.status(error.status || 400).json({
        error: error.message || "File extraction failed.",
      });
    }
  });
});

routes.post.set("/chat", async (req, res) => {
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
      history: [
        ...safeHistory,
        { role: "user", content: composedUserText },
      ],
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

export { formatAttachmentContext };
