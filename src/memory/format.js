import { wrapUntrustedContent } from "../prompts/injectionGuard.js";

/** Formats retrieved long-term-memory facts into a context block for the model. */
export function formatMemoryContext(retrievedItems) {
  if (!retrievedItems?.length) return "";
  const lines = retrievedItems.map((item) => `- ${item.text}`);
  return wrapUntrustedContent("memory", "saved facts relevant to this question", lines.join("\n"));
}
