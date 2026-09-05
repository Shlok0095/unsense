/**
 * Backend-owned source metadata. The model only ever sees a numbered list
 * ([1], [2], ...) and is instructed to cite by number — it never invents a
 * URL that reaches the user, because the frontend (public/linkUtils.js)
 * only turns a [n] marker into a link when n maps to one of these verified
 * source objects. This module builds that canonical list and the untrusted
 * context block handed to the model.
 */
import { shortLinkLabel } from "../linkUtils.js";
import { wrapUntrustedContent } from "../prompts/injectionGuard.js";

/** Canonical source shape returned to the frontend and used for citation mapping. */
export function toSourceObjects(rawResults = []) {
  const now = new Date().toISOString();
  return rawResults
    .filter((item) => item?.url)
    .map((item, index) => {
      let domain = "";
      try {
        domain = new URL(item.url).hostname.replace(/^www\./, "");
      } catch {
        /* ignore malformed URL */
      }
      return {
        id: index + 1,
        title: item.title || "",
        url: item.url,
        domain,
        snippet: item.snippet || "",
        excerpt: item.excerpt || "",
        label: shortLinkLabel(item.url, item.title),
        retrievedAt: now,
      };
    });
}

/** The context block prepended to the user's message when web search ran. */
export function formatSearchContext(query, sources, { responseMode = "research" } = {}) {
  if (!sources?.length) {
    return wrapUntrustedContent(
      "web",
      `search for "${query}"`,
      `No results were found for this query. Answer from existing knowledge and clearly note the limitation — do not invent facts or sources.`
    );
  }

  const lines = sources.map((s) => {
    const excerptBlock = s.excerpt ? `\n   Excerpt: ${s.excerpt}` : "";
    return `${s.id}. [${s.label}](${s.url})\n   ${s.snippet || s.title}${excerptBlock}`;
  });

  const citationRules =
    responseMode === "research"
      ? `Cite these sources inline using their number, e.g. [1], [2]. Only cite a
number from this list — never write a URL or source that is not listed here.
Use the research structure from your system instructions (Summary / Evidence / Analysis).`
      : `These are optional reference results. Use them to improve accuracy but keep
your answer in the style required by your system instructions for this mode.
Cite [n] only when a listed source directly supports a specific claim. Do NOT
force a Summary/Evidence/Analysis news layout unless the user asked for
current-events research. Do not invent citations — if a source does not support
a claim, do not cite it.`;

  const body = `${lines.join("\n\n")}

${citationRules}`;

  return wrapUntrustedContent("web", `search results for "${query}"`, body);
}
