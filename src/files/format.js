import { wrapUntrustedContent } from "../prompts/injectionGuard.js";

/** Formats retrieved document chunks (with metadata) into a context block. */
export function formatDocumentContext(retrievedChunks) {
  if (!retrievedChunks?.length) return "";

  const blocks = retrievedChunks.map((chunk) => {
    const location = [
      chunk.filename,
      chunk.page ? `page ${chunk.page}` : null,
      chunk.heading || null,
    ]
      .filter(Boolean)
      .join(" — ");
    return `[${location || "document"}]\n${chunk.text}`;
  });

  return wrapUntrustedContent(
    "document",
    "relevant excerpts from the uploaded file(s)",
    blocks.join("\n\n")
  );
}
