import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linkifySearchCitations,
  linkifySourceListLines,
  prepareMarkdownSources,
  shortLinkLabel,
  stripInventedCitationLines,
  stripTrailingSourcesSection,
} from "../../public/linkUtils.js";

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

test("linkifySourceListLines turns bibliography rows into markdown links", () => {
  const out = linkifySourceListLines(
    '[1] "Reverse Engineering on macOS" by [Author]',
    sources
  );
  assert.match(out, /\[1 · Reverse Engineering on macOS\]\(https:\/\/example\.com\/a\)/);
});

test("stripTrailingSourcesSection removes model-generated bibliographies", () => {
  const md = "Answer text.\n\n## Sources\n[1] fake";
  assert.equal(stripTrailingSourcesSection(md), "Answer text.");
});

test("stripTrailingSourcesSection removes plain Sources header without markdown hash", () => {
  const md =
    'Answer text.\n\nSources\n\n[1] "Android Tutorial" by Thewhitehats.com\n[2] "Androguard" by Medium.com';
  assert.equal(stripTrailingSourcesSection(md), "Answer text.");
});

test("stripTrailingSourcesSection removes Cited sources block", () => {
  const md = "Answer.\n\nCited sources:\n[1] fake";
  assert.equal(stripTrailingSourcesSection(md), "Answer.");
});

test("stripInventedCitationLines removes fake bibliography without Sources header", () => {
  const md =
    'Conclusion text.\n\n[1] "Android Hacking Tutorial" by HackersBlog.com\n[2] "Rooting" by XDA-Developers.com';
  assert.equal(stripInventedCitationLines(md), "Conclusion text.");
});

test("prepareMarkdownSources removes android fake sources block from user example", () => {
  const md = `Answer body here.

Sources

[1] "Android App Reverse Engineering Tutorial" by Thewhitehats.com

[2] "Reverse Engineering Android Apps with Androguard" by Medium.com`;
  assert.equal(prepareMarkdownSources(md, []), "Answer body here.");
});

test("prepareMarkdownSources strips fake sources when none are verified", () => {
  const md = "Answer.\n\n## Sources\n[1] \"Fake\" by [Author]";
  assert.equal(prepareMarkdownSources(md, []), "Answer.");
  const plain = 'Answer.\n\nSources\n\n[1] "Fake" by example.com';
  assert.equal(prepareMarkdownSources(plain, []), "Answer.");
});

test("prepareMarkdownSources strips fake sources section when verified exist", () => {
  const md = "See [1] for details.\n\n## Sources\n[1] \"Title\" by [Author]";
  const out = prepareMarkdownSources(md, sources);
  assert.doesNotMatch(out, /## Sources/);
  assert.equal(out, "See [1] for details.");
});
