/**
 * Centralized input validation for API request bodies. Every limit here is
 * intentionally conservative and generous enough for legitimate use — the
 * goal is to reject obviously abusive payloads, not to police content.
 */

export const LIMITS = {
  MAX_MESSAGE_CHARS: 16000,
  MAX_HISTORY_MESSAGES: 200,
  MAX_HISTORY_MESSAGE_CHARS: 32000,
  MAX_ATTACHMENT_CONTEXT_CHARS: 60000,
  MAX_MEMORY_ITEMS: 100,
  MAX_MEMORY_ITEM_CHARS: 500,
  MAX_MODE_LENGTH: 32,
};

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
  }
}

export function validateMessage(message) {
  if (typeof message !== "string" || !message.trim()) {
    throw new ValidationError("Message is required.");
  }
  if (message.length > LIMITS.MAX_MESSAGE_CHARS) {
    throw new ValidationError(
      `Message is too long (max ${LIMITS.MAX_MESSAGE_CHARS.toLocaleString()} characters).`
    );
  }
  return message.trim();
}

export function validateHistory(history) {
  if (history === undefined || history === null) return [];
  if (!Array.isArray(history)) {
    throw new ValidationError("History must be an array.");
  }
  if (history.length > LIMITS.MAX_HISTORY_MESSAGES) {
    throw new ValidationError("Conversation history is too long.");
  }

  return history
    .filter(
      (entry) =>
        entry &&
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string"
    )
    .map(({ role, content }) => ({
      role,
      content:
        content.length > LIMITS.MAX_HISTORY_MESSAGE_CHARS
          ? content.slice(0, LIMITS.MAX_HISTORY_MESSAGE_CHARS)
          : content,
    }));
}

export function validateAttachmentContext(value) {
  if (typeof value !== "string") return "";
  if (value.length > LIMITS.MAX_ATTACHMENT_CONTEXT_CHARS) {
    return value.slice(0, LIMITS.MAX_ATTACHMENT_CONTEXT_CHARS);
  }
  return value;
}

export function validateDocumentChunks(chunks) {
  if (!Array.isArray(chunks)) return [];
  return chunks
    .filter(
      (c) =>
        c &&
        typeof c.text === "string" &&
        c.text.trim() &&
        typeof c.chunkId === "string"
    )
    .slice(0, 500) // hard cap so a crafted payload can't force unbounded work
    .map((c) => ({
      chunkId: String(c.chunkId).slice(0, 80),
      documentId: String(c.documentId || "").slice(0, 80),
      filename: String(c.filename || "").slice(0, 200),
      page: typeof c.page === "number" ? c.page : null,
      heading: typeof c.heading === "string" ? c.heading.slice(0, 200) : null,
      text: c.text.slice(0, 4000),
    }));
}

export function validateMemoryItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .slice(0, LIMITS.MAX_MEMORY_ITEMS)
    .map((m) => ({
      id: String(m.id || "").slice(0, 80),
      text: m.text.slice(0, LIMITS.MAX_MEMORY_ITEM_CHARS),
    }));
}

export function validateThink(value) {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "on";
  }
  return false;
}

const VALID_MODES = new Set(["fast", "think", "research", "analyze", "code"]);

export function validateMode(mode) {
  if (typeof mode !== "string") return "fast";
  const clean = mode.trim().toLowerCase().slice(0, LIMITS.MAX_MODE_LENGTH);
  return VALID_MODES.has(clean) ? clean : "fast";
}

const VALID_PRIVACY = new Set(["normal", "temporary", "private", "local"]);

export function validatePrivacyMode(mode) {
  if (typeof mode !== "string") return "normal";
  const clean = mode.trim().toLowerCase();
  return VALID_PRIVACY.has(clean) ? clean : "normal";
}
