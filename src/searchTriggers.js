/**
 * Detect if a query likely needs live web data.
 */
const WEB_TRIGGERS = [
  /\b(latest|current|today|recent|news|now|2025|2026)\b/i,
  /\b(price|stock|weather|score|election)\b/i,
  /\b(who is (the )?current|what happened)\b/i,
  /\b(search (the )?web|look up online|find online)\b/i,
  /^\/web\b/i,
];

const KNOWLEDGE_CUTOFF_PHRASES = [
  /\b(as of|up to date|real.?time|live data)\b/i,
];

export function shouldSearchWeb(message, explicit = false) {
  if (explicit) return true;
  const text = message.trim();
  if (text.startsWith("/web ")) return true;
  return (
    WEB_TRIGGERS.some((re) => re.test(text)) ||
    KNOWLEDGE_CUTOFF_PHRASES.some((re) => re.test(text))
  );
}

export function extractSearchQuery(message) {
  const trimmed = message.trim();
  if (trimmed.startsWith("/web ")) {
    return trimmed.slice(5).trim();
  }
  return trimmed;
}
