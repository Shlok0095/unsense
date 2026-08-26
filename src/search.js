/**
 * DuckDuckGo web search (no API key required).
 * Uses the Instant Answer API + HTML lite fallback for snippets.
 */

import { enrichSearchResults, shortLinkLabel } from "./linkUtils.js";

const DDG_API = "https://api.duckduckgo.com/";
const DDG_HTML = "https://html.duckduckgo.com/html/";

async function fetchInstantAnswers(query) {
  const url = `${DDG_API}?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "HFUncensoredChat/1.0" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const results = [];

  if (data.Abstract) {
    results.push({
      title: data.Heading || "Instant Answer",
      snippet: data.Abstract,
      url: data.AbstractURL || "",
    });
  }

  for (const topic of data.RelatedTopics || []) {
    if (topic.Text && topic.FirstURL) {
      results.push({
        title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 80),
        snippet: topic.Text,
        url: topic.FirstURL,
      });
    }
    if (topic.Topics) {
      for (const sub of topic.Topics) {
        if (sub.Text && sub.FirstURL) {
          results.push({
            title: sub.Text.split(" - ")[0] || sub.Text.slice(0, 80),
            snippet: sub.Text,
            url: sub.FirstURL,
          });
        }
      }
    }
  }

  return results.slice(0, 5);
}

async function fetchHtmlResults(query) {
  const body = new URLSearchParams({ q: query, kl: "us-en" });
  const res = await fetch(DDG_HTML, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "HFUncensoredChat/1.0",
    },
    body: body.toString(),
  });
  if (!res.ok) return [];

  const html = await res.text();
  const results = [];
  const resultBlocks = html.match(
    /<a rel="nofollow" class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
  );

  if (!resultBlocks) return results;

  for (const block of resultBlocks.slice(0, 5)) {
    const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const urlMatch = block.match(/href="([^"]+)"/);
    if (titleMatch && snippetMatch) {
      results.push({
        title: stripHtml(titleMatch[1]),
        snippet: stripHtml(snippetMatch[1]),
        url: urlMatch ? decodeURIComponent(urlMatch[1].replace(/.*uddg=/, "")) : "",
      });
    }
  }

  return results;
}

function stripHtml(text) {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export async function searchWeb(query) {
  const instant = await fetchInstantAnswers(query);
  let payload;

  if (instant.length >= 2) {
    payload = { query, results: instant, source: "duckduckgo-instant" };
  } else {
    const html = await fetchHtmlResults(query);
    const merged = [...instant, ...html].slice(0, 6);
    payload = {
      query,
      results: merged,
      source: merged.length ? "duckduckgo" : "none",
    };
  }

  return {
    ...payload,
    results: enrichSearchResults(payload.results),
  };
}

export function formatSearchContext(searchData) {
  if (!searchData?.results?.length) {
    return `[Web search for "${searchData?.query || ""}" returned no results. Answer from your knowledge and note limitations.]`;
  }

  const lines = searchData.results.map((r) => {
    const label = r.label || shortLinkLabel(r.url, r.title);
    return `${r.id}. [${label}](${r.url})\n   ${r.snippet || r.title}`;
  });

  return `[Web search results for "${searchData.query}"]

${lines.join("\n\n")}

[Cite sources using short markdown links only — e.g. [wikipedia.org](url) or [1](url). Never paste raw long URLs. List all used links under ## Sources & Further Reading as numbered short links.]`;
}
