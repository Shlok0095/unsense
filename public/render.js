import {
  linkifyBareUrls,
  linkifySearchCitations,
  repairBrokenSourceLinks,
  shortLinkLabel,
  wireCitationLinks,
} from "./linkUtils.js";

let markedConfigured = false;

function configureMarked() {
  if (markedConfigured || !window.marked) return;
  window.marked.setOptions({ breaks: true, gfm: true });
  markedConfigured = true;
}

function shortenLinksInHtml(html, sources) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    const text = anchor.textContent?.trim() || "";
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    if (href && (text.startsWith("http") || text.length > 48)) {
      anchor.textContent = shortLinkLabel(href, text);
    }
  });
  let output = doc.body.innerHTML;
  output = repairBrokenSourceLinks(output, sources);
  output = wireCitationLinks(output, sources);
  return output;
}

/** Markdown -> sanitized-by-marked HTML string, with citations wired to
 * backend-verified sources. Math/code enhancement happens after insertion
 * into the DOM — see enhanceRenderedElement(). */
export function renderMarkdownToHtml(text, sources = []) {
  configureMarked();
  let prepared = linkifyBareUrls(text);
  prepared = linkifySearchCitations(prepared, sources);
  if (window.marked) {
    return shortenLinksInHtml(window.marked.parse(prepared), sources);
  }
  return prepared.replace(/\n/g, "<br>");
}

/** Applies syntax highlighting, adds a copy button to code blocks, and
 * renders LaTeX/math — call once after the HTML above is in the live DOM. */
export function enhanceRenderedElement(container) {
  if (window.hljs) {
    container.querySelectorAll("pre code").forEach((block) => {
      window.hljs.highlightElement(block);
      const pre = block.parentElement;
      if (pre.querySelector(".code-copy-btn")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(block.textContent || "");
          btn.textContent = "Copied";
          setTimeout(() => (btn.textContent = "Copy"), 1500);
        } catch {
          /* clipboard unavailable — silently ignore */
        }
      });
      pre.style.position = "relative";
      pre.appendChild(btn);
    });
  }

  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(container, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    } catch {
      /* malformed math in the response — leave raw text rather than crash */
    }
  }
}

function normalizeSourceUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function createSourceCards(sources = []) {
  const usable = sources
    .map((item) => ({ ...item, url: normalizeSourceUrl(item?.url) }))
    .filter((item) => item.url);
  if (!usable.length) return null;

  const row = document.createElement("div");
  row.className = "source-links";

  const label = document.createElement("span");
  label.className = "source-links-label";
  label.textContent = "sources:";
  row.appendChild(label);

  for (const item of usable) {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = item.title || item.url;
    link.textContent = `[${item.id}] ${item.label || shortLinkLabel(item.url, item.title)}`;
    row.appendChild(link);
  }

  return row;
}

export function createFollowupChips(followups = [], onPick) {
  if (!followups?.length) return null;

  const row = document.createElement("div");
  row.className = "followup-chip-row";
  for (const suggestion of followups) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "followup-chip";
    chip.textContent = suggestion;
    chip.addEventListener("click", () => onPick(suggestion));
    row.appendChild(chip);
  }
  return row;
}

/** Small hover toolbar attached to a message: copy / regenerate / edit / branch. */
export function createMessageToolbar(actions) {
  const bar = document.createElement("div");
  bar.className = "message-toolbar";

  const buttons = [
    actions.onCopy && ["Copy", "copy", actions.onCopy],
    actions.onEdit && ["Edit", "edit", actions.onEdit],
    actions.onRegenerate && ["Regenerate", "regenerate", actions.onRegenerate],
    actions.onBranch && ["Branch", "branch", actions.onBranch],
    actions.onRemember && ["Remember", "remember", actions.onRemember],
  ].filter(Boolean);

  for (const [label, action, handler] of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `toolbar-btn toolbar-btn-${action}`;
    btn.textContent = label;
    btn.addEventListener("click", handler);
    bar.appendChild(btn);
  }

  return bar;
}
