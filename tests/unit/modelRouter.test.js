import { test } from "node:test";
import assert from "node:assert/strict";
import { routeModel } from "../../src/models/modelRouter.js";
import { buildSystemPrompt } from "../../src/prompts/index.js";

test("routeModel keeps general think intent on the fast primary tier", () => {
  const { primary } = routeModel({ mode: "think" });
  const fast = routeModel({ mode: "fast" }).primary;
  assert.equal(primary.provider, fast.provider);
  assert.equal(primary.model, fast.model);
});

test("routeModel uses deep tier for research and code intents", () => {
  const models = {
    fast: "fast-model",
    deep: "deep-model",
    code: "code-model",
    fallback: "fallback-model",
  };
  const original = process.env.HF_PRIMARY_MODEL;
  const originalDeep = process.env.HF_DEEP_MODEL;
  const originalCode = process.env.HF_CODE_MODEL;
  process.env.HF_PRIMARY_MODEL = models.fast;
  process.env.HF_DEEP_MODEL = models.deep;
  process.env.HF_CODE_MODEL = models.code;
  process.env.HF_FALLBACK_MODEL = models.fallback;

  try {
    assert.equal(routeModel({ mode: "research" }).primary.model, models.deep);
    assert.equal(routeModel({ mode: "code" }).primary.model, models.code);
  } finally {
    if (original === undefined) delete process.env.HF_PRIMARY_MODEL;
    else process.env.HF_PRIMARY_MODEL = original;
    if (originalDeep === undefined) delete process.env.HF_DEEP_MODEL;
    else process.env.HF_DEEP_MODEL = originalDeep;
    if (originalCode === undefined) delete process.env.HF_CODE_MODEL;
    else process.env.HF_CODE_MODEL = originalCode;
  }
});

test("buildSystemPrompt appends think depth overlay when requested", () => {
  const prompt = buildSystemPrompt("research", { thinkRequested: true });
  assert.match(prompt, /Think mode is ON/i);
});
