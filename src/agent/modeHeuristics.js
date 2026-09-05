/**
 * Zero-cost heuristics for classifying response mode when Think is enabled.
 * Runs before any LLM call — most prompts are decided here.
 */
import { matchesWebTrigger } from "./intentHeuristics.js";

const CODE_PATTERNS = [
  /```[\s\S]*```/,
  /\b(write|create|implement|build|debug|fix|refactor|optimize)\b.{0,40}\b(function|class|script|api|component|module|algorithm)\b/i,
  /\b(python|javascript|typescript|java|golang|rust|c\+\+|sql|html|css|react|node\.?js)\b/i,
  /\b(stack trace|syntax error|compile error|runtime error|segfault|null pointer)\b/i,
  /\bhow (do|to) (i )?(write|code|implement)\b/i,
  /^\/code\b/i,
];

const ANALYZE_PATTERNS = [
  /\b(summarize|summarise|analyze|analyse|compare|contrast|review|critique)\b.{0,30}\b(document|file|pdf|report|paper|article|attachment)\b/i,
  /\bwhat does (this|the) (document|file|pdf|report) say\b/i,
  /\b(extract|find|identify).{0,30}\b(from the|in the) (document|file|text)\b/i,
  /\bkey (points|findings|takeaways).{0,20}\b(document|file)\b/i,
];

const THINK_PATTERNS = [
  /\b(explain (in detail|step by step|thoroughly)|walk me through|reason about|think through)\b/i,
  /\b(pros and cons|trade-?offs|compare and contrast|evaluate|assess)\b/i,
  /\b(why does|how does|what are the implications|what would happen if)\b/i,
  /\?.*\?/,
];

export function classifyByHeuristics(message, { hasDocuments = false } = {}) {
  const text = message.trim();
  if (!text) return null;

  if (hasDocuments) {
    return { mode: "analyze", confidence: "high" };
  }

  if (CODE_PATTERNS.some((re) => re.test(text))) {
    return { mode: "code", confidence: "high" };
  }

  if (ANALYZE_PATTERNS.some((re) => re.test(text))) {
    return { mode: "analyze", confidence: "high" };
  }

  if (matchesWebTrigger(text)) {
    return { mode: "research", confidence: "high" };
  }

  if (text.length > 280 || THINK_PATTERNS.some((re) => re.test(text))) {
    return { mode: "think", confidence: "high" };
  }

  if (text.length > 120) {
    return { mode: "think", confidence: "low" };
  }

  return null;
}
