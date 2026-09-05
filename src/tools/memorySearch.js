import { retrieve } from "../rag/retriever.js";

/**
 * Retrieves relevant long-term memory facts. Memory itself lives entirely
 * client-side (public/memory.js, localStorage) since there is no server
 * database — the client sends its memory items with the request, the same
 * way it already sends chat history, and this tool just ranks them.
 */
export const memorySearchTool = {
  name: "memory_search",
  description: "Searches the user's saved long-term memory facts for content relevant to the current question.",
  schema: { query: "string" },
  permissions: [],
  timeoutMs: 500,
  async handler({ query }, context) {
    const items = context?.memoryItems || [];
    if (!items.length) return { matched: false, results: [] };
    const asChunks = items.map((m) => ({ chunkId: m.id, text: m.text }));
    return retrieve(query, asChunks, { topK: 5 });
  },
};
