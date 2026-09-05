/**
 * Fetches a short text excerpt from a URL — used both to enrich search
 * results and by the fetch_url tool. Every fetch here goes through the SSRF
 * guard first (src/security/ssrf.js): user- and model-influenced URLs must
 * never be allowed to reach loopback/private/link-local addresses.
 */
import { isSafeUrlToFetch, isSyntacticallySafeUrl } from "../security/ssrf.js";

const FETCH_TIMEOUT_MS = 5000;
export const MAX_EXCERPT_CHARS = 2000;

function stripHtml(text) {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function extractTextExcerpt(html, maxChars) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  return stripHtml(withoutNoise).slice(0, maxChars);
}

/**
 * Fetches a page and returns a plain-text excerpt, or "" on any failure —
 * page-fetch failures are always non-fatal to the caller.
 */
export async function fetchPageExcerpt(url, { maxChars = MAX_EXCERPT_CHARS } = {}) {
  if (!isSyntacticallySafeUrl(url)) return "";
  if (!(await isSafeUrlToFetch(url))) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // A generic bot UA gets blocked by a lot of sites (Cloudflare, etc).
        // This is a non-fatal excerpt fetch either way, but a normal-looking
        // browser UA measurably improves the hit rate.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    if (!res.ok) return "";

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return "";
    }

    // Re-validate the final URL after redirects — `redirect: "follow"` means
    // undici already followed them, but we still check the last hop so a
    // redirect chain can't land on a private address unnoticed.
    if (res.url && res.url !== url && !(await isSafeUrlToFetch(res.url))) {
      return "";
    }

    const html = await res.text();
    return extractTextExcerpt(html, maxChars);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichWithPageExcerpts(results, { maxPages = 2 } = {}) {
  const targets = results.slice(0, maxPages);
  const excerpts = await Promise.all(targets.map((r) => fetchPageExcerpt(r.url)));

  return results.map((result, index) => {
    if (index >= excerpts.length) return result;
    const excerpt = excerpts[index];
    return excerpt ? { ...result, excerpt } : result;
  });
}
