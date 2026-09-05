import { test } from "node:test";
import assert from "node:assert/strict";
import { linkifySearchCitations, shortLinkLabel } from "../../public/linkUtils.js";

const sources = [{ id: 1, url: "https://example.com/a", title: "Example" }];

test("linkifySearchCitations converts a numeric citation marker to a real link", () => {
  const out = linkifySearchCitations("citation [1] here.", sources);
  assert.match(out, /\[1 · Example · example\.com\]\(https:\/\/example\.com\/a\)/);
});

test("linkifySearchCitations does not corrupt the URL when the source's own host also appears as bare prose", () => {
  // Regression test: an earlier version linkified bare host mentions AFTER
  // inserting numeric-citation URLs, which could match the host text
  // sitting inside the URL it had just inserted (e.g. "example.com" inside
  // "https://example.com/a"), corrupting the href into a nested link.
  const out = linkifySearchCitations(
    "citation [1] here, also see example.com directly.",
    sources
  );
  const hrefs = [...out.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  for (const href of hrefs) {
    assert.equal(href, "https://example.com/a", `corrupted href: ${href}`);
  }
  assert.equal(hrefs.length, 2);
});

test("shortLinkLabel combines a trimmed title with the hostname", () => {
  assert.equal(shortLinkLabel("https://www.example.com/x", "Some Title"), "Some Title · example.com");
  assert.equal(shortLinkLabel("https://example.com/x", ""), "example.com");
  assert.equal(shortLinkLabel("", "fallback"), "fallback");
});
