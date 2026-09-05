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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBrokenHref(href) {
  if (!href || href === "#") return true;
  if (!/^https?:\/\//i.test(href)) return true;
  return /full-url|example\.com\/|your-url|insert-url/i.test(href);
}

export function stripTrailingSourcesSection(markdown) {
  if (!markdown) return markdown;
  return markdown.replace(/\n#{1,3}\s*Sources(?:\s*&\s*Further\s*Reading)?\b[\s\S]*$/i, "").trimEnd();
}

/** Turn bibliography lines like `[1] "Title" by [Author]` into markdown links. */
export function linkifySourceListLines(markdown, sources = []) {
  if (!markdown || !sources?.length) return markdown;

  const byId = new Map(
    sources
      .filter((result) => result?.id && result?.url)
      .map((result) => [String(result.id), result])
  );
  if (!byId.size) return markdown;

  return markdown.replace(/^\[(\d+)\]\s*(.+)$/gm, (full, id, rest) => {
    const source = byId.get(id);
    if (!source) return full;
    const cleanTitle = rest
      .replace(/\s*by\s*\[Author\]\s*$/i, "")
      .replace(/^["'“”]|["'“”]$/g, "")
      .trim();
    const label = cleanTitle
      ? `${id} · ${cleanTitle}`
      : `${id} · ${shortLinkLabel(source.url, source.title)}`;
    return `[${label}](${source.url})`;
  });
}

export function prepareMarkdownSources(markdown, sources = []) {
  let text = markdown || "";
  const verified = sources.filter((s) => s?.url);
  const hasSourcesSection = /\n#{1,3}\s*Sources\b/i.test(text);

  if (verified.length) {
    if (hasSourcesSection) text = stripTrailingSourcesSection(text);
    text = linkifySourceListLines(text, verified);
  } else if (hasSourcesSection) {
    // Model invented a bibliography with no verified URLs — drop it.
    text = stripTrailingSourcesSection(text);
  }

  return text;
}

export function linkifyBareUrls(text) {
  if (!text) return text;

  return text.replace(
    /(?<!\]\()https?:\/\/[^\s<>)\]]+/g,
    (url) => `[${shortLinkLabel(url)}](${url})`
  );
}

export function linkifySearchCitations(markdown, results = []) {
  if (!results?.length || !markdown) return markdown;

  let text = markdown;

  // Pass 1: bare mentions of a source's domain in plain prose (e.g. "...
  // according to example.com ...") become links. This MUST run before pass 2
  // inserts any URLs — a URL for one source can itself contain another
  // source's host as a substring (e.g. "https://example.com/a" contains
  // "example.com"), and running this pass afterward would corrupt that URL
  // by linkifying the host text found inside it.
  for (const result of results) {
    const { url } = result;
    if (!url) continue;
    const host = hostFromUrl(url);
    if (!host) continue;
    text = text.replace(
      new RegExp(`(?<!\\]\\()\\b${escapeRegex(host)}\\b(?!\\])`, "gi"),
      `[${host}](${url})`
    );
  }

  // Pass 2: numeric citation markers ([1], [1][site-name]) become links.
  for (const result of results) {
    const { id, url } = result;
    if (!id || !url) continue;

    const label = shortLinkLabel(url, result.title);

    text = text.replace(
      new RegExp(`\\[${id}\\]\\s*\\[([^\\]]+)\\](?!\\()`, "g"),
      `[${id} · $1](${url})`
    );

    text = text.replace(
      new RegExp(`\\[${id}\\](?!\\()`, "g"),
      `[${id} · ${label}](${url})`
    );
  }

  return text;
}

export function repairBrokenSourceLinks(html, results = []) {
  if (!results?.length || !html) return html;

  const byId = new Map();
  const byHost = new Map();

  for (const result of results) {
    if (!result?.url) continue;
    byId.set(String(result.id), result.url);
    const host = hostFromUrl(result.url);
    if (host) byHost.set(host.toLowerCase(), result.url);
  }

  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("a").forEach((anchor) => {
    let href = anchor.getAttribute("href") || "";
    const text = anchor.textContent?.trim() || "";

    if (!isBrokenHref(href)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      return;
    }

    const idMatch = text.match(/\[?(\d+)\]?/);
    if (idMatch && byId.has(idMatch[1])) {
      href = byId.get(idMatch[1]);
    } else {
      for (const [host, url] of byHost) {
        if (text.toLowerCase().includes(host)) {
          href = url;
          break;
        }
      }
    }

    if (href && !isBrokenHref(href)) {
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
  });

  return doc.body.innerHTML;
}

export function wireCitationLinks(html, results = []) {
  if (!results?.length || !html) return html;

  const byId = new Map(
    results
      .filter((result) => result?.id && result?.url)
      .map((result) => [String(result.id), result.url])
  );

  if (!byId.size) return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  const citationRe = /\[(\d+)\]/g;

  for (const node of textNodes) {
    if (node.parentElement?.closest("a")) continue;

    const text = node.textContent || "";
    if (!/\[\d+\]/.test(text)) continue;

    const frag = doc.createDocumentFragment();
    let lastIndex = 0;
    let match;

    citationRe.lastIndex = 0;
    while ((match = citationRe.exec(text))) {
      const id = match[1];
      const url = byId.get(id);
      if (match.index > lastIndex) {
        frag.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
      }

      if (url) {
        const link = doc.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.className = "citation-link";
        link.textContent = `[${id}]`;
        frag.appendChild(link);
      } else {
        frag.appendChild(doc.createTextNode(match[0]));
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      frag.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }

    if (lastIndex > 0) {
      node.parentNode.replaceChild(frag, node);
    }
  }

  return doc.body.innerHTML;
}

export function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
