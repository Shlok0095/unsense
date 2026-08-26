export function shortLinkLabel(url, title = "") {
  if (!url) return title || "source";

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const cleanTitle = (title || "").replace(/\s+/g, " ").trim();

    if (cleanTitle) {
      const trimmed =
        cleanTitle.length > 32 ? `${cleanTitle.slice(0, 29)}...` : cleanTitle;
      return `${trimmed} · ${host}`;
    }

    return host;
  } catch {
    return title || "source";
  }
}

export function enrichSearchResults(results = []) {
  return results
    .filter((item) => item?.url)
    .map((item, index) => ({
      id: index + 1,
      title: item.title || "",
      url: item.url,
      snippet: item.snippet || "",
      excerpt: item.excerpt || "",
      label: shortLinkLabel(item.url, item.title),
    }));
}

export function linkifyBareUrls(text) {
  if (!text) return text;

  return text.replace(
    /(?<!\]\()https?:\/\/[^\s<>)\]]+/g,
    (url) => `[${shortLinkLabel(url)}](${url})`
  );
}
