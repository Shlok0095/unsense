/**
 * Structured, dependency-free request telemetry.
 *
 * Vercel captures stdout/stderr from serverless functions as function logs,
 * so a single structured JSON line per event is enough to get real
 * observability without adding a logging service. Never log full message
 * content — only shapes/sizes/flags — so user conversations stay out of logs.
 */
import { randomUUID } from "crypto";

export function newRequestId() {
  return `req_${randomUUID()}`;
}

function emit(level, event, fields) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const text = JSON.stringify(line);
  if (level === "error" || level === "warn") {
    console.error(text);
  } else {
    console.log(text);
  }
}

/**
 * Creates a per-request logger that automatically stamps requestId and
 * accumulates a duration when `done()` is called.
 */
export function createRequestLogger(event, fields = {}) {
  const requestId = fields.requestId || newRequestId();
  const start = Date.now();

  emit("info", `${event}.start`, { requestId, ...safeFields(fields) });

  return {
    requestId,
    info(subEvent, extra = {}) {
      emit("info", `${event}.${subEvent}`, { requestId, ...safeFields(extra) });
    },
    warn(subEvent, extra = {}) {
      emit("warn", `${event}.${subEvent}`, { requestId, ...safeFields(extra) });
    },
    error(subEvent, extra = {}) {
      emit("error", `${event}.${subEvent}`, { requestId, ...safeFields(extra) });
    },
    done(extra = {}) {
      emit("info", `${event}.done`, {
        requestId,
        latencyMs: Date.now() - start,
        ...safeFields(extra),
      });
    },
  };
}

// Strips anything that looks like raw user/document content or secrets from
// logged fields, keeping only sizes/flags/ids. Defensive allowlist approach:
// only pass through primitive values and known-safe shapes.
const DENY_KEYS = new Set([
  "message",
  "userMessage",
  "content",
  "history",
  "text",
  "token",
  "apiKey",
  "authorization",
]);

function safeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (DENY_KEYS.has(key)) continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.length; // log counts, not content
    } else if (typeof value === "object") {
      out[key] = "[object]";
    }
  }
  return out;
}
