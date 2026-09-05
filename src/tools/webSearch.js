import { searchWeb } from "../search/index.js";

export const webSearchTool = {
  name: "web_search",
  description: "Searches the web (DuckDuckGo) for current information and returns ranked, sourced results.",
  schema: { query: "string" },
  permissions: ["network"],
  timeoutMs: 12000,
  async handler({ query }) {
    if (!query || !query.trim()) throw new Error("A search query is required.");
    return searchWeb(query.trim());
  },
};
