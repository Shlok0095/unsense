/**
 * Small evaluation harness — compares response quality/latency/reliability
 * across the configured model tiers on a fixed set of representative
 * prompts. Not a full eval platform (no labeled golden answers, no
 * hallucination scoring model) — it checks the things that are cheaply and
 * objectively checkable: did it respond at all, how long did it take, does
 * the answer's shape match what the prompt asked for (code block present
 * for a coding question, a citation present when search should have run,
 * roughly-expected length for the mode).
 *
 * Usage: `npm run eval` (needs a working HF_TOKEN in the environment).
 */
import "dotenv/config";
import { generate } from "../src/models/gateway.js";
import { getToken } from "../src/config.js";
import { buildSystemPrompt } from "../src/prompts/index.js";

const CASES = [
  {
    name: "simple-factual",
    mode: "fast",
    prompt: "What is the capital of France?",
    expect: (text) => /paris/i.test(text),
  },
  {
    name: "coding-request",
    mode: "code",
    prompt: "Write a JavaScript function that reverses a string.",
    expect: (text) => /```/.test(text),
  },
  {
    name: "research-depth",
    mode: "research",
    prompt: "Explain the tradeoffs between REST and GraphQL APIs.",
    expect: (text) => text.length > 400,
  },
  {
    name: "analysis-structure",
    mode: "analyze",
    prompt: "What are the key considerations when choosing a database for a new project?",
    expect: (text) => text.length > 200,
  },
  {
    name: "greeting-brevity",
    mode: "fast",
    prompt: "hi",
    expect: (text) => text.length < 400, // should NOT produce a 2000-word essay for "hi"
  },
];

async function runCase(testCase) {
  const start = Date.now();
  try {
    const result = await generate({
      token: getToken(),
      mode: testCase.mode,
      messages: [
        { role: "system", content: buildSystemPrompt(testCase.mode) },
        { role: "user", content: testCase.prompt },
      ],
      temperature: 0.5,
      maxTokens: 1024,
    });
    const latencyMs = Date.now() - start;
    const passed = testCase.expect(result.content);
    return {
      name: testCase.name,
      ok: true,
      passed,
      latencyMs,
      model: result.model,
      usedFallback: result.usedFallback,
      chars: result.content.length,
    };
  } catch (error) {
    return {
      name: testCase.name,
      ok: false,
      passed: false,
      latencyMs: Date.now() - start,
      error: error.message,
    };
  }
}

async function main() {
  if (!getToken()) {
    console.error("HF_TOKEN is not set — cannot run the evaluation.");
    process.exit(1);
  }

  console.log(`Running ${CASES.length} evaluation cases...\n`);
  const results = [];
  for (const testCase of CASES) {
    process.stdout.write(`  ${testCase.name}... `);
    const result = await runCase(testCase);
    results.push(result);
    console.log(
      result.ok
        ? `${result.passed ? "PASS" : "FAIL"} (${result.latencyMs}ms, ${result.chars} chars, model=${result.model}${result.usedFallback ? " [fallback]" : ""})`
        : `ERROR (${result.latencyMs}ms): ${result.error}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const errored = results.filter((r) => !r.ok).length;
  console.log(`\n${passed}/${results.length} passed, ${errored} errored.`);

  if (passed < results.length) process.exitCode = 1;
}

main();
