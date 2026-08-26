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

export function linkifyBareUrls(text) {
  if (!text) return text;

  return text.replace(
    /(?<!\]\()https?:\/\/[^\s<>)\]]+/g,
    (url) => `[${shortLinkLabel(url)}](${url})`
  );
}

export function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
