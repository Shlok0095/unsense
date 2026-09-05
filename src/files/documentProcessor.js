import { randomUUID } from "crypto";
import { extractFiles } from "./parser.js";
import { chunkText } from "../rag/chunker.js";

/**
 * Parses uploaded files and chunks them for retrieval. Nothing here is
 * persisted server-side (serverless, no DB) — the returned chunks are sent
 * back to the client, which stores them in localStorage alongside the
 * session (public/documents.js) and re-sends the relevant ones with each
 * follow-up question. That's what makes multi-turn document Q&A possible
 * without a server-side vector store.
 */
export async function processUploads(files, nvidiaApiKey) {
  const extracts = await extractFiles(files, nvidiaApiKey);

  const documents = extracts.map((extract) => {
    const documentId = randomUUID();
    const chunks = chunkText(extract.text, { documentId, filename: extract.name });
    return {
      documentId,
      filename: extract.name,
      mime: extract.mime,
      chars: extract.chars,
      usedVision: extract.usedVision,
      chunkCount: chunks.length,
      chunks,
    };
  });

  return documents;
}

/** Legacy-shaped context block for backward compatibility / small files
 * where retrieval would be overkill — used as a fallback by the handler
 * when a document has very few chunks. */
export function formatAttachmentContext(extracts) {
  if (!extracts?.length) return "";
  const blocks = extracts.map((item) => `### File: ${item.filename}\n${item.chunks.map((c) => c.text).join("\n\n")}`);
  return blocks.join("\n\n---\n\n");
}
