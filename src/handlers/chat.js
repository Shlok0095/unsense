import { getToken, hasOllama } from "../config.js";
import { runOrchestration } from "../agent/orchestrator.js";
import { resolveResponseMode } from "../agent/modeResolver.js";
import { toUserFacingApiError } from "../errors.js";
import { createRequestLogger } from "../observability/logger.js";
import { checkRateLimit } from "../security/rateLimit.js";
import {
  validateMessage,
  validateHistory,
  validateDocumentChunks,
  validateMemoryItems,
  validateMode,
  validateThink,
  validatePrivacyMode,
  ValidationError,
} from "../security/validation.js";

function writeSseEvent(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function handleChat(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const rate = checkRateLimit(req, { limit: 30, name: "chat" });
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  const log = createRequestLogger("chat");

  let input;
  try {
    const body = req.body ?? {};
    const privacyMode = validatePrivacyMode(body.privacyMode);
    input = {
      privacyMode,
      think: validateThink(body.think),
      mode: validateMode(body.mode),
      userText: validateMessage(body.message),
      history: validateHistory(body.history),
      documentChunks: validateDocumentChunks(body.documentChunks),
      memoryItems: validateMemoryItems(body.memoryItems),
      memoryEnabled: Boolean(body.memoryEnabled) && privacyMode !== "private",
      // Local privacy mode has its own (narrower) web-search behavior
      // handled inside decideWebSearch — this flag is just the user's
      // explicit Settings > Search toggle.
      webSearchEnabled: body.webSearchEnabled !== false,
      existingSummary:
        typeof body.conversationSummary === "string"
          ? body.conversationSummary.slice(0, 4000)
          : null,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      log.error("validation_failed", { message: error.message });
      return res.status(400).json({ error: error.message });
    }
    log.error("body_parse_failed", { message: error.message });
    return res.status(400).json({ error: "Invalid request body." });
  }
  const {
    privacyMode,
    think,
    userText,
    history,
    documentChunks,
    memoryItems,
    memoryEnabled,
    webSearchEnabled,
    existingSummary,
  } = input;

  const token = getToken();
  const canUseLocalOnly = privacyMode === "local" && hasOllama();
  if (!token && !canUseLocalOnly) {
    return res.status(503).json({
      error: "HF_TOKEN is not configured on the server.",
    });
  }

  const { mode: resolvedMode } = await resolveResponseMode({
    think,
    message: userText,
    documentChunks,
    token,
    privacyMode,
  });

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Aborts the upstream model call if the client disconnects mid-stream
  // (e.g. the user hits "stop" or closes the tab). Deliberately listens on
  // `res` (the response socket), not `req` — the request stream is already
  // fully consumed by the JSON body parser by this point, and `req`'s
  // "close"/"aborted" events can fire as soon as that read completes, long
  // before the response is done, which would abort every request instantly.
  // `res.on("close")` reflects the actual outbound connection to the client.
  const controller = new AbortController();
  const onClose = () => controller.abort();
  res.on("close", onClose);

  log.info("start", {
    think,
    mode: resolvedMode,
    privacyMode,
    historyLength: history.length,
    documentChunkCount: documentChunks.length,
    memoryItemCount: memoryEnabled ? memoryItems.length : 0,
  });

  try {
    const stream = runOrchestration({
      token,
      privacyMode,
      mode: resolvedMode,
      thinkRequested: think,
      userMessage: userText,
      history,
      existingSummary,
      documentChunks,
      memoryItems,
      memoryEnabled,
      webSearchEnabled,
      signal: controller.signal,
    });

    let finalEvent = null;
    for await (const event of stream) {
      if (event.type === "error") {
        const status = event.error?.status || 502;
        const message = toUserFacingApiError(event.error?.message, status);
        writeSseEvent(res, { type: "error", error: message, status });
        log.error("model_error", { status, message: event.error?.message });
        res.off("close", onClose);
        res.end();
        return;
      }
      if (event.type === "done") finalEvent = event;
      writeSseEvent(res, event);
    }

    log.done({
      success: true,
      provider: finalEvent?.provider,
      model: finalEvent?.model,
      usedFallback: finalEvent?.usedFallback,
      sourceCount: finalEvent?.sources?.length || 0,
      followupCount: finalEvent?.followups?.length || 0,
    });
  } catch (error) {
    if (error?.name === "AbortError" || controller.signal.aborted) {
      log.info("client_aborted");
    } else {
      log.error("unhandled_error", { message: error.message });
      writeSseEvent(res, {
        type: "error",
        error: toUserFacingApiError(error.message, error.status || 502),
        status: error.status || 502,
      });
    }
  } finally {
    res.off("close", onClose);
    res.end();
  }
}
