import { SYSTEM_PROMPT, CONTEXT_WINDOW_MESSAGES } from "./prompts.js";
import { shouldSearchWeb, extractSearchQuery } from "./searchTriggers.js";
import { searchWeb, formatSearchContext } from "./search.js";
import { chatCompletionWithFallback } from "./hfClient.js";

export function buildApiMessages(history, { searchContext = null } = {}) {
  const windowed = history.slice(-CONTEXT_WINDOW_MESSAGES);
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  for (let i = 0; i < windowed.length; i++) {
    const msg = windowed[i];
    const isLastUser =
      i === windowed.length - 1 && msg.role === "user" && searchContext;

    if (isLastUser) {
      messages.push({
        role: "user",
        content: `${searchContext}\n\n---\n\nUser question:\n${msg.content}`,
      });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  return messages;
}

export async function runChat({
  token,
  userMessage,
  history,
  temperature = 0.65,
}) {
  let searchMeta = null;
  let searchContext = null;

  if (shouldSearchWeb(userMessage, true)) {
    const query = extractSearchQuery(userMessage);
    try {
      searchMeta = await searchWeb(query);
      searchContext = formatSearchContext(searchMeta);
    } catch (error) {
      console.warn("[search] failed:", error.message);
      searchContext = `[Web search failed: ${error.message}. Answer from your knowledge and note limitations.]`;
    }
  }

  const messages = buildApiMessages(history, { searchContext });

  const result = await chatCompletionWithFallback({
    token,
    messages,
    temperature,
  });

  return {
    ...result,
    webSearch: searchMeta
      ? {
          used: true,
          query: searchMeta.query,
          resultCount: searchMeta.results?.length ?? 0,
          source: searchMeta.source,
          results: searchMeta.results ?? [],
        }
      : { used: false },
  };
}
