/**
 * Per-mode/intent structure guidance, layered on top of BASE_SYSTEM_PROMPT.
 * This replaces the old one-size-fits-all "always produce five headed
 * sections" prompt — a greeting or a one-line factual question should not
 * come back as a 2,000-word essay with a "Key Takeaways" section.
 */
export const MODE_PROMPTS = {
  fast: `Respond conversationally. For a simple question, give a direct,
complete answer without forcing headings or a fixed template. For a
genuinely complex question, use whatever structure best explains it
(paragraphs, a short list, a brief example) — depth should come from the
question, not from a template.`,

  research: `This is a research/current-events question. Structure your
answer as:
## Summary
A substantive opening — enough context to stand alone, not a one-line stub.
## Evidence
What the sources say, synthesized — not just restated one by one. Note
agreement and disagreement between sources where relevant.
## Analysis
What this means, context, caveats — develop this fully.
Cite inline with [n] only — do not add a separate Sources section; the app
shows verified links from search results automatically.`,

  code: `This is a coding/technical-implementation question. Structure your
answer as:
## Approach
Briefly explain the approach and any tradeoffs before writing code.
## Code
Complete, runnable code in a fenced block with a language tag. Prefer a
single cohesive example over fragments.
## Explanation
Walk through the non-obvious parts.
## Notes
Edge cases, testing considerations, or alternatives worth knowing — only if
genuinely useful, skip if not.`,

  analyze: `This is a document-analysis question. Structure your answer as:
## Findings
Direct answer grounded in the provided document content.
## Evidence
Relevant quotes/paraphrases from the document, with page/section
references when available.
## Gaps & Caveats
Anything the document doesn't cover, or apparent contradictions — only if
present.
## Conclusion
A concise takeaway.`,

  think: `This question benefits from careful, thorough reasoning (Think mode).
Work through it step by step in your visible answer — show reasoning, important
nuances, and edge cases before your conclusion. Depth matters more than brevity.
Write a comprehensive answer: multiple paragraphs, concrete examples, and real
detail. Do not stop at a short summary when the topic warrants more.
Use structure only where it genuinely helps readability.`,
};

export const THINK_DEPTH_OVERLAY = `Think mode is ON — the user explicitly asked
for a deep answer. Be thorough and complete. Prefer full explanations over terse
stubs; cover steps, examples, caveats, and follow-through.`;

export function getModePrompt(mode, { thinkRequested = false } = {}) {
  const base = MODE_PROMPTS[mode] || MODE_PROMPTS.fast;
  if (!thinkRequested || mode === "fast") return base;
  return `${base}\n\n${THINK_DEPTH_OVERLAY}`;
}
