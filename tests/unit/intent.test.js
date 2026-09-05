import { test } from "node:test";
import assert from "node:assert/strict";
import { decideWebSearch } from "../../src/agent/intent.js";
import { classifyByHeuristics } from "../../src/agent/modeHeuristics.js";
import { formatSearchContext } from "../../src/search/citations.js";
import { toSourceObjects } from "../../src/search/citations.js";

test("classifyByHeuristics routes android 2026 search prompt to research", () => {
  const msg =
    "go deep and search on intenet for real time hacking tools of android apps in 2026 or for reverse engineering";
  const result = classifyByHeuristics(msg);
  assert.equal(result.mode, "research");
});

test("classifyByHeuristics routes short hack question to think", () => {
  const result = classifyByHeuristics("tell me the ways to hack windows laptop");
  assert.equal(result.mode, "think");
});

test("decideWebSearch skips auto search for think mode without freshness signals", async () => {
  const result = await decideWebSearch({
    token: "unused",
    message: "tell me the ways to hack windows laptop",
    mode: "think",
    privacyMode: "normal",
    webSearchEnabled: true,
  });
  assert.equal(result.needsWeb, false);
});

test("decideWebSearch still searches for research mode", async () => {
  const result = await decideWebSearch({
    token: "unused",
    message: "latest AI news",
    mode: "research",
    privacyMode: "normal",
    webSearchEnabled: true,
  });
  assert.equal(result.needsWeb, true);
});

test("formatSearchContext for think mode discourages research template", () => {
  const sources = toSourceObjects([
    { url: "https://example.com/tool", title: "Tool", snippet: "snippet" },
  ]);
  const context = formatSearchContext("android tools", sources, { responseMode: "think" });
  assert.match(context, /Do NOT\s+force a Summary\/Evidence\/Analysis/i);
  assert.doesNotMatch(context, /Sources & Further Reading/i);
});
