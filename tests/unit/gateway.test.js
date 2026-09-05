import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generate, generateStream } from "../../src/models/gateway.js";
import { _resetHealthForTests } from "../../src/models/health.js";

beforeEach(() => _resetHealthForTests());

function withEnv(vars, fn) {
  const prev = {};
  for (const key of Object.keys(vars)) prev[key] = process.env[key];
  Object.assign(process.env, vars);
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(vars)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });
}

test("generate() falls back to the secondary model on a 5xx from the primary", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.model === "test-primary") {
      return { ok: false, status: 503, text: async () => JSON.stringify({ error: "overloaded" }) };
    }
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: "x",
          choices: [{ message: { content: "fallback answer" }, finish_reason: "stop" }],
        }),
    };
  };

  await withEnv(
    { HF_PRIMARY_MODEL: "test-primary", HF_FALLBACK_MODEL: "test-fallback" },
    async () => {
      const result = await generate({
        token: "t",
        mode: "fast",
        messages: [{ role: "user", content: "hi" }],
      });
      assert.equal(result.content, "fallback answer");
      assert.equal(result.usedFallback, true);
      assert.equal(result.model, "test-fallback");
    }
  );
});

test("generate() does not fall back on a non-retryable error (e.g. 400)", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: false, status: 400, text: async () => JSON.stringify({ error: "bad request" }) };
  };

  await withEnv(
    { HF_PRIMARY_MODEL: "test-primary", HF_FALLBACK_MODEL: "test-fallback" },
    async () => {
      await assert.rejects(() =>
        generate({ token: "t", mode: "fast", messages: [{ role: "user", content: "hi" }] })
      );
      assert.equal(calls, 1, "should not have tried the fallback model");
    }
  );
});

test("generateStream() falls back before any token has streamed", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const encoder = new TextEncoder();
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.model === "test-primary") {
      return { ok: false, status: 500, body: null, text: async () => JSON.stringify({ error: "down" }) };
    }
    return {
      ok: true,
      status: 200,
      body: {
        async *[Symbol.asyncIterator]() {
          yield encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: "ok" }, finish_reason: "stop" } ] })}\n\n`
          );
          yield encoder.encode(`data: [DONE]\n\n`);
        },
      },
    };
  };

  await withEnv(
    { HF_PRIMARY_MODEL: "test-primary", HF_FALLBACK_MODEL: "test-fallback" },
    async () => {
      const events = [];
      for await (const event of generateStream({
        token: "t",
        mode: "fast",
        messages: [{ role: "user", content: "hi" }],
      })) {
        events.push(event);
      }
      const done = events.find((e) => e.type === "done");
      assert.ok(done);
      assert.equal(done.content, "ok");
      assert.equal(done.usedFallback, true);
      assert.equal(done.model, "test-fallback");
    }
  );
});
