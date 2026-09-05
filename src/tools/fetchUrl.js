import { fetchPageExcerpt } from "../search/fetcher.js";
import { isSyntacticallySafeUrl } from "../security/ssrf.js";

export const fetchUrlTool = {
  name: "fetch_url",
  description: "Fetches a specific web page and extracts a plain-text excerpt from it.",
  schema: { url: "string, a full http(s) URL" },
  permissions: ["network"],
  timeoutMs: 8000,
  async handler({ url }) {
    if (!isSyntacticallySafeUrl(url)) {
      throw new Error("That URL cannot be fetched (invalid or not a public http/https address).");
    }
    const excerpt = await fetchPageExcerpt(url, { maxChars: 4000 });
    if (!excerpt) {
      throw new Error("Could not extract readable content from that URL.");
    }
    return { url, excerpt };
  },
};
