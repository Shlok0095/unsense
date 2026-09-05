import { fetchSearchResults } from "./providers.js";
import { enrichWithPageExcerpts } from "./fetcher.js";
import { toSourceObjects, formatSearchContext } from "./citations.js";

export { formatSearchContext } from "./citations.js";

/**
 * Runs a web search and returns backend-owned, enriched source objects.
 * Never throws for "no results" — only for genuine network failure, which
 * callers treat as non-fatal (chat continues without search context).
 */
export async function searchWeb(query) {
  const { results, source } = await fetchSearchResults(query);
  const sources = toSourceObjects(results);
  const withExcerpts = await enrichWithPageExcerpts(sources);
  return { query, source, results: withExcerpts };
}
