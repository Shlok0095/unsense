import { retrieve } from "../rag/retriever.js";

/**
 * Retrieves the most relevant chunks from the documents attached to the
 * current conversation (passed in by the client — see memory note in
 * rag/README below). No server-side document storage exists; the client
 * (public/documents.js) keeps chunks in localStorage per session and sends
 * them along with each request, same trust model as chat history.
 */
export const fileSearchTool = {
  name: "file_search",
  description: "Searches the user's uploaded documents for content relevant to the current question.",
  schema: { query: "string" },
  permissions: [],
  timeoutMs: 1000,
  async handler({ query }, context) {
    const chunks = context?.documentChunks || [];
    if (!chunks.length) return { matched: false, results: [] };
    return retrieve(query, chunks, { topK: 6 });
  },
};
