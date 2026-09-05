/**
 * Fast, zero-model-call heuristics for Think-mode intent routing.
 * Stricter than before — bare language names alone do not imply "code".
 */
import { matchesWebTrigger } from "./intentHeuristics.js";

const CODE_PATTERNS = [
  /```[\s\S]*```/,
  /\b(write|create|implement|build|debug|fix|refactor|optimize)\b.{0,50}\b(function|class|script|api|component|module|algorithm|code)\b/i,
  /\b(python|javascript|typescript|java|golang|rust|c\+\+|sql|react|node\.?js)\b.{0,40}\b(function|class|script|code|error|bug|implement)\b/i,
  /\b(function|class|script|api|component)\b.{0,40}\b(python|javascript|typescript|java|golang|rust|c\+\+|sql|react)\b/i,
  /\b(stack trace|syntax error|compile error|runtime error|segfault|null pointer|typeerror|referenceerror)\b/i,
  /\bhow (do|to) (i )?(write|code|implement|debug|fix)\b/i,
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
  /\b(reverse engineer|architecture|design pattern|best approach)\b/i,
  /\?.*\?/,
];

export function classifyByHeuristics(message, { hasDocuments = false } = {}) {
  const text = message.trim();
  if (!text) return { mode: "think", confidence: "high" };

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

  if (text.length > 200 || THINK_PATTERNS.some((re) => re.test(text))) {
    return { mode: "think", confidence: "high" };
  }

  if (text.length > 80) {
    return { mode: "think", confidence: "low" };
  }

  // Short prompts with Think on still deserve deep tier — default think.
  return { mode: "think", confidence: "low" };
}
