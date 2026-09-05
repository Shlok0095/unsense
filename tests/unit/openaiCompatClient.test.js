import { test } from "node:test";
import assert from "node:assert/strict";
import {
  callChatCompletion,
  streamChatCompletion,
} from "../../src/models/openaiCompatClient.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

/** Builds a fake fetch Response whose .body is an SSE byte stream. */
function sseResponse(frames) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    body: {
      async *[Symbol.asyncIterator]() {
        for (const frame of frames) {
          yield encoder.encode(frame);
        }
      },
    },
  };
}

test("callChatCompletion parses a normal completion", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    jsonResponse(200, {
      id: "cmpl_1",
      choices: [{ message: { content: "hello there" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    });

  const result = await callChatCompletion({
    url: "https://example.test/v1/chat/completions",
    headers: {},
    providerName: "test",
    model: "m",
    messages: [],
    max_tokens: 10,
  });

  assert.equal(result.content, "hello there");
  assert.equal(result.finishReason, "stop");
  assert.equal(result.usage.totalTokens, 12);
});

test("callChatCompletion throws a structured error on a non-2xx response", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => jsonResponse(401, { error: { message: "bad token" } });

  await assert.rejects(
    () =>
      callChatCompletion({
        url: "https://example.test/v1/chat/completions",
        headers: {},
        providerName: "test",
        model: "m",
        messages: [],
        max_tokens: 10,
      }),
    (error) => {
      assert.equal(error.status, 401);
      assert.match(error.message, /bad token/);
      return true;
    }
  );
});

test("streamChatCompletion yields deltas then a done event", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const frames = [
    `data: ${JSON.stringify({ id: "c1", choices: [{ delta: { content: "Hel" } }] })}\n\n`,
    `data: ${JSON.stringify({ id: "c1", choices: [{ delta: { content: "lo" } }] })}\n\n`,
    `data: ${JSON.stringify({
      id: "c1",
      choices: [{ delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    })}\n\n`,
    `data: [DONE]\n\n`,
  ];

  globalThis.fetch = async () => sseResponse(frames);

  const events = [];
  for await (const event of streamChatCompletion({
    url: "https://example.test/v1/chat/completions",
    headers: {},
    providerName: "test",
    model: "m",
    messages: [],
    max_tokens: 10,
  })) {
    events.push(event);
  }

  const deltas = events.filter((e) => e.type === "delta").map((e) => e.text);
  assert.deepEqual(deltas, ["Hel", "lo"]);

  const done = events.find((e) => e.type === "done");
  assert.ok(done, "expected a done event");
  assert.equal(done.content, "Hello");
  assert.equal(done.finishReason, "stop");
  assert.equal(done.usage.totalTokens, 5);
});

test("streamChatCompletion yields an error event on upstream failure", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    body: null,
    text: async () => JSON.stringify({ error: { message: "rate limited" } }),
  });

  const events = [];
  for await (const event of streamChatCompletion({
    url: "https://example.test/v1/chat/completions",
    headers: {},
    providerName: "test",
    model: "m",
    messages: [],
    max_tokens: 10,
  })) {
    events.push(event);
  }

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "error");
  assert.equal(events[0].error.status, 429);
});

test("streamChatCompletion treats an empty stream as an error", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => sseResponse([`data: [DONE]\n\n`]);

  const events = [];
  for await (const event of streamChatCompletion({
    url: "https://example.test/v1/chat/completions",
    headers: {},
    providerName: "test",
    model: "m",
    messages: [],
    max_tokens: 10,
  })) {
    events.push(event);
  }

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "error");
});
