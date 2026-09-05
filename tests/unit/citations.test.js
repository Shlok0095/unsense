import { test } from "node:test";
import assert from "node:assert/strict";
import { toSourceObjects, formatSearchContext } from "../../src/search/citations.js";

test("toSourceObjects assigns stable sequential ids and derives domain", () => {
  const sources = toSourceObjects([
    { url: "https://www.example.com/a", title: "Example A", snippet: "s1" },
    { url: "https://docs.example.org/b", title: "Docs B", snippet: "s2" },
    { title: "No URL — should be dropped" },
  ]);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].id, 1);
  assert.equal(sources[0].domain, "example.com"); // www. stripped
  assert.equal(sources[1].id, 2);
  assert.equal(sources[1].domain, "docs.example.org");
  assert.ok(sources[0].retrievedAt);
});

test("formatSearchContext only ever includes URLs from the given source list", () => {
  const sources = toSourceObjects([
    { url: "https://real-source.example/page", title: "Real Source", snippet: "actual content" },
  ]);
  const context = formatSearchContext("test query", sources);

  assert.match(context, /real-source\.example/);
  assert.match(context, /never write a URL or source that is not listed\s+here/i);
  // The instruction text itself must not introduce a second, fabricated domain.
  const urlMatches = context.match(/https?:\/\/[^\s)]+/g) || [];
  for (const url of urlMatches) {
    assert.ok(url.includes("real-source.example"), `unexpected URL leaked into context: ${url}`);
  }
});

test("formatSearchContext handles zero results without inventing a source", () => {
  const context = formatSearchContext("test query", []);
  assert.match(context, /No results were found/);
  assert.doesNotMatch(context, /https?:\/\//);
});
