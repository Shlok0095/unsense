/**
 * Guards against chat-template leakage and runaway generation.
 *
 * Llama / ChatML models can emit structural tokens (im_start, im_end, …)
 * or simulate extra turns when stop sequences are missing. Industry practice:
 * 1) stop sequences on the API, 2) sanitize streamed output, 3) neutralize
 * special tokens in untrusted user/history text before it reaches the model.
 */

const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);
const IM_START = `${LT}|im_start|${GT}`;
const IM_END = `${LT}|im_end|${GT}`;
const REDACTED_IM_END = `${LT}|redacted_im_end|${GT}`;
const EOT_ID = `${LT}|eot_id|${GT}`;
const END_OF_TEXT = `${LT}|endoftext|${GT}`;
const BEGIN_OF_TEXT = `${LT}|begin_of_text|${GT}`;

/** OpenAI-compatible APIs accept at most 4 stop strings. */
export const CHAT_STOP_SEQUENCES = [IM_START, IM_END, REDACTED_IM_END, EOT_ID];

const TEMPLATE_MARKERS = [
  IM_START,
  IM_END,
  REDACTED_IM_END,
  EOT_ID,
  END_OF_TEXT,
  BEGIN_OF_TEXT,
];

const INPUT_TOKEN_REPLACEMENTS = [
  [new RegExp(`\\${LT}\\|im_start\\|${GT}`, "gi"), "‹im_start›"],
  [new RegExp(`\\${LT}\\|im_end\\|${GT}`, "gi"), "‹im_end›"],
  [new RegExp(`\\${LT}\\|redacted_im_end\\|${GT}`, "gi"), "‹im_end›"],
  [new RegExp(`\\${LT}\\|eot_id\\|${GT}`, "gi"), "‹eot_id›"],
  [new RegExp(`\\${LT}\\|endoftext\\|${GT}`, "gi"), "‹endoftext›"],
  [new RegExp(`\\${LT}\\|begin_of_text\\|${GT}`, "gi"), "‹begin_of_text›"],
];

/** Longest suffix of `text` that is a prefix of any marker (incomplete token). */
function holdbackSuffixLength(text) {
  let hold = 0;
  for (const marker of TEMPLATE_MARKERS) {
    const max = Math.min(marker.length - 1, text.length);
    for (let len = max; len >= 1; len--) {
      if (marker.startsWith(text.slice(-len))) {
        hold = Math.max(hold, len);
        break;
      }
    }
  }
  return hold;
}

function earliestMarkerIndex(text) {
  let idx = -1;
  for (const marker of TEMPLATE_MARKERS) {
    const at = text.indexOf(marker);
    if (at !== -1 && (idx === -1 || at < idx)) idx = at;
  }
  return idx;
}

/**
 * Collapse pathological single-character repetition (e.g. 500× "!").
 * Keeps a short run so the UI doesn't look broken if the model hiccups.
 */
export function collapseRunawayRepetition(text, maxRun = 12, threshold = 48) {
  if (!text) return "";
  return text.replace(/(.)\1{47,}/g, (match, ch) => {
    const run = Math.min(maxRun, threshold);
    return ch.repeat(run);
  });
}

/**
 * Final pass on a complete assistant string (also used by non-streaming paths).
 */
export function sanitizeAssistantOutput(text) {
  if (!text) return "";
  let cleaned = String(text);
  const markerAt = earliestMarkerIndex(cleaned);
  if (markerAt !== -1) cleaned = cleaned.slice(0, markerAt);
  for (const marker of TEMPLATE_MARKERS) {
    cleaned = cleaned.split(marker).join("");
  }
  cleaned = cleaned.replace(/<\|[^|>]{1,48}\|>/g, "");
  cleaned = collapseRunawayRepetition(cleaned);
  return cleaned.trim();
}

/** Neutralize structural tokens in user/history content (prompt-injection guard). */
export function sanitizeMessageContent(text) {
  if (!text) return "";
  let cleaned = String(text);
  for (const [pattern, replacement] of INPUT_TOKEN_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

export function sanitizeMessages(messages) {
  return (messages || []).map((msg) => ({
    ...msg,
    content: sanitizeMessageContent(msg.content),
  }));
}

/**
 * Stateful filter for SSE token chunks. Stops at template markers and
 * runaway character repetition; handles markers split across chunks.
 */
export function createStreamSanitizer({ maxCharRun = 48 } = {}) {
  let buffer = "";
  let stopped = false;
  let lastChar = "";
  let runLength = 0;

  function noteChar(ch) {
    if (!ch) return false;
    if (ch === lastChar) {
      runLength += 1;
      if (runLength > maxCharRun) {
        stopped = true;
        return true;
      }
    } else {
      lastChar = ch;
      runLength = 1;
    }
    return false;
  }

  return {
    push(chunk) {
      if (stopped || !chunk) return { text: "", stopped: true };

      buffer += chunk;
      for (const ch of chunk) {
        if (noteChar(ch)) break;
      }
      if (stopped) {
        const markerAt = earliestMarkerIndex(buffer);
        let safe = markerAt === -1 ? buffer : buffer.slice(0, markerAt);
        if (runLength > maxCharRun && lastChar) {
          const tailRun = lastChar.repeat(runLength);
          if (safe.endsWith(tailRun)) {
            safe = safe.slice(0, -runLength) + lastChar.repeat(Math.min(8, maxCharRun));
          }
        }
        buffer = "";
        return { text: collapseRunawayRepetition(safe), stopped: true };
      }

      const markerAt = earliestMarkerIndex(buffer);
      if (markerAt !== -1) {
        const emit = buffer.slice(0, markerAt);
        buffer = "";
        stopped = true;
        return { text: collapseRunawayRepetition(emit), stopped: true };
      }

      const hold = holdbackSuffixLength(buffer);
      const emit = hold ? buffer.slice(0, -hold) : buffer;
      buffer = hold ? buffer.slice(-hold) : "";
      return { text: collapseRunawayRepetition(emit), stopped: false };
    },

    finish() {
      if (stopped) return { text: "", stopped: true };
      const tail = sanitizeAssistantOutput(buffer);
      buffer = "";
      return { text: tail, stopped: false };
    },
  };
}
