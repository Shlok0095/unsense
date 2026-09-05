/**
 * Fast, free, zero-model-call heuristics for "does this need a live web
 * search". These run before ever spending a model call on the question —
 * most messages are decided here.
 */
const WEB_TRIGGERS = [
  /\b(latest|current|today|recent|news|now|2025|2026|2027)\b/i,
  /\b(price|stock|weather|score|election)\b/i,
  /\b(who is (the )?current|what happened)\b/i,
  /\b(search (the )?web|look up online|find online)\b/i,
  /\b(as of|up to date|real.?time|live data)\b/i,
  /^\/web\b/i,
];

const SKIP_PATTERNS = [
  /^(hi|hello|hey|thanks|thank you|bye|yo|sup)\b[!.?\s]*$/i,
  /^(good morning|good night|how are you)\b/i,
  /^write (me )?(a |an )?(poem|story|song|rap|joke|haiku)\b/i,
  /^help me (write|debug|fix|refactor)\b/i,
  /^(\d+(\.\d+)?\s*[+\-*/^]\s*\d+(\.\d+)?)(\s*=\s*\??)?$/,
];

export function isForcedSearch(message) {
  return message.trim().startsWith("/web ");
}

export function extractForcedSearchQuery(message) {
  return message.trim().slice(5).trim();
}

export function matchesWebTrigger(message) {
  return WEB_TRIGGERS.some((re) => re.test(message));
}

export function matchesSkipSearch(message) {
  return SKIP_PATTERNS.some((re) => re.test(message.trim()));
}
