/**
 * DuckDuckGo web search (no API key required).
 * Uses the Instant Answer API + HTML lite fallback for snippets.
 */

import { enrichSearchResults, shortLinkLabel } from "./linkUtils.js";

const DDG_API = "https://api.duckduckgo.com/";
const DDG_HTML = "https://html.duckduckgo.com/html/";
const PAGE_FETCH_TIMEOUT_MS = 5000;
const MAX_PAGE_EXCERPT_CHARS = 2000;
const MAX_PAGES_TO_FETCH = 2;

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

function extractTextExcerpt(html) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = stripHtml(withoutNoise);
  return text.slice(0, MAX_PAGE_EXCERPT_CHARS);
}

function isFetchableUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchPageExcerpt(url) {
  if (!isFetchableUrl(url)) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "HFUncensoredChat/1.0" },
      redirect: "follow",
    });
    if (!res.ok) return "";

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return "";
    }

    const html = await res.text();
    return extractTextExcerpt(html);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function enrichWithPageExcerpts(results) {
  const targets = results.slice(0, MAX_PAGES_TO_FETCH);
  const excerpts = await Promise.all(
    targets.map((result) => fetchPageExcerpt(result.url))
  );

  return results.map((result, index) => {
    if (index >= excerpts.length) return result;
    const excerpt = excerpts[index];
    return excerpt ? { ...result, excerpt } : result;
  });
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

  const enriched = enrichSearchResults(payload.results);
  const withExcerpts = await enrichWithPageExcerpts(enriched);

  return {
    ...payload,
    results: withExcerpts,
  };
}

export function formatSearchContext(searchData) {
  if (!searchData?.results?.length) {
    return `[Web search for "${searchData?.query || ""}" returned no results. Answer from your knowledge and note limitations.]`;
  }

  const lines = searchData.results.map((r) => {
    const label = r.label || shortLinkLabel(r.url, r.title);
    const excerptBlock = r.excerpt
      ? `\n   Excerpt: ${r.excerpt}`
      : "";
    return `${r.id}. [${label}](${r.url})\n   ${r.snippet || r.title}${excerptBlock}`;
  });

  return `[Web search results for "${searchData.query}"]

${lines.join("\n\n")}

[Cite sources using clickable markdown links with real URLs — e.g. [wikipedia.org](https://...) or [1 · site.com](https://...). Never use placeholder URLs like "full-url". List all used links under ## Sources & Further Reading.]`;
}
