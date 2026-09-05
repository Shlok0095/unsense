import { test } from "node:test";
import assert from "node:assert/strict";
import { windowHistory, assembleContextEnvelope, estimateTokens } from "../../src/agent/contextManager.js";

test("estimateTokens is a rough chars/4 heuristic", () => {
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("a".repeat(40)), 10);
});

test("windowHistory returns everything untouched when under the window size", async () => {
  const history = [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
  ];
  const result = await windowHistory({
    token: "t",
    mode: "fast",
    privacyMode: "normal",
    history,
    existingSummary: null,
  });
  assert.deepEqual(result.recentHistory, history);
  assert.equal(result.summary, null);
  assert.equal(result.summarizedCount, 0);
});

test("windowHistory summarizes overflow and reports how many messages were absorbed", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        choices: [{ message: { content: "- fact one\n- fact two" }, finish_reason: "stop" }],
      }),
  });

  // CONTEXT_WINDOW_MESSAGES is 16 — build 20 messages so 4 overflow.
  const history = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `message ${i}`,
  }));

  const result = await windowHistory({
    token: "t",
    mode: "fast",
    privacyMode: "normal",
    history,
    existingSummary: null,
  });

  assert.equal(result.summarizedCount, 4);
  assert.equal(result.recentHistory.length, 16);
  assert.equal(result.recentHistory[0].content, "message 4");
  assert.match(result.summary, /fact/);
});

test("assembleContextEnvelope drops the lowest-priority section first under a tight budget", () => {
  process.env.CONTEXT_TOKEN_BUDGET = "5"; // ~20 chars total — forces trimming
  const envelope = assembleContextEnvelope({
    summary: "old summary content that is somewhat long",
    memoryBlock: "",
    documentBlock: "",
    webBlock: "fresh web evidence block",
  });
  delete process.env.CONTEXT_TOKEN_BUDGET;

  // Web (priority 5, kept longest) should survive; summary (priority 6,
  // dropped first) should not, once budget is exhausted.
  assert.match(envelope, /fresh web evidence/);
});

test("assembleContextEnvelope returns an empty string when there is no context", () => {
  assert.equal(
    assembleContextEnvelope({ summary: null, memoryBlock: "", documentBlock: "", webBlock: "" }),
    ""
  );
});
