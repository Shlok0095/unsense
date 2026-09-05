import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../src/app.js";

function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function parseSse(text) {
  return text
    .split("\n\n")
    .filter((frame) => frame.startsWith("data:"))
    .map((frame) => JSON.parse(frame.slice(5).trim()));
}

test("GET /api/health reports configuration and registered tools", async (t) => {
  const server = await startServer(createApp());
  const { port } = server.address();
  t.after(() => stopServer(server));

  const res = await fetch(`http://127.0.0.1:${port}/api/health`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.tools));
  assert.ok(data.tools.includes("web_search"));
  assert.ok(data.tools.includes("calculator"));
});

test("POST /api/chat streams a full SSE answer for a simple greeting (no search, no follow-ups)", async (t) => {
  process.env.HF_TOKEN = "fake-token-for-test";
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete process.env.HF_TOKEN;
  });

  const encoder = new TextEncoder();
  // Only the HF chat-completions endpoint should be mocked — the test's own
  // request to the local ephemeral server must go through the real fetch.
  globalThis.fetch = async (url, opts) => {
    const urlStr = String(url);
    if (!urlStr.includes("router.huggingface.co")) {
      return originalFetch(url, opts);
    }
    return {
      ok: true,
      status: 200,
      body: {
        async *[Symbol.asyncIterator]() {
          yield encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello! " } }] })}\n\n`
          );
          yield encoder.encode(
            `data: ${JSON.stringify({
              choices: [{ delta: { content: "How can I help?" }, finish_reason: "stop" }],
            })}\n\n`
          );
          yield encoder.encode(`data: [DONE]\n\n`);
        },
      },
    };
  };

  const server = await startServer(createApp());
  const { port } = server.address();
  t.after(() => stopServer(server));

  const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hi", mode: "fast", history: [] }),
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/event-stream; charset=utf-8");

  const text = await res.text();
  const events = parseSse(text);

  const deltas = events.filter((e) => e.type === "delta").map((e) => e.text).join("");
  assert.equal(deltas, "Hello! How can I help?");

  const done = events.find((e) => e.type === "done");
  assert.ok(done, "expected a done event");
  assert.equal(done.content, "Hello! How can I help?");
  assert.equal(done.finishReason, "stop");
  assert.deepEqual(done.sources, []);
  assert.deepEqual(done.followups, []); // skipped for a trivial greeting
});

test("POST /api/chat rejects an empty message with 400", async (t) => {
  process.env.HF_TOKEN = "fake-token-for-test";
  t.after(() => delete process.env.HF_TOKEN);

  const server = await startServer(createApp());
  const { port } = server.address();
  t.after(() => stopServer(server));

  const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "   ", history: [] }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /message is required/i);
});

test("POST /api/chat returns 503 when no token is configured and not in local mode", async (t) => {
  const original = process.env.HF_TOKEN;
  delete process.env.HF_TOKEN;
  t.after(() => {
    if (original !== undefined) process.env.HF_TOKEN = original;
  });

  const server = await startServer(createApp());
  const { port } = server.address();
  t.after(() => stopServer(server));

  const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hello", history: [] }),
  });

  assert.equal(res.status, 503);
});
