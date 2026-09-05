import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyByHeuristics } from "../../src/agent/modeHeuristics.js";
import { resolveResponseMode, modeStatusLabel } from "../../src/agent/modeResolver.js";

test("classifyByHeuristics detects coding prompts", () => {
  const result = classifyByHeuristics("write a python function to sort a list");
  assert.equal(result.mode, "code");
  assert.equal(result.confidence, "high");
});

test("classifyByHeuristics detects document analysis when attachments present", () => {
  const result = classifyByHeuristics("what is this about?", { hasDocuments: true });
  assert.equal(result.mode, "analyze");
  assert.equal(result.confidence, "high");
});

test("classifyByHeuristics detects research triggers", () => {
  const result = classifyByHeuristics("what is the latest news about AI today?");
  assert.equal(result.mode, "research");
});

test("resolveResponseMode returns fast when think is off", async () => {
  const result = await resolveResponseMode({
    think: false,
    message: "write a python function",
    token: "t",
  });
  assert.equal(result.mode, "fast");
});

test("resolveResponseMode uses heuristics when think is on", async () => {
  const result = await resolveResponseMode({
    think: true,
    message: "debug this javascript error in my react component",
    token: "t",
  });
  assert.equal(result.mode, "code");
});

test("resolveResponseMode falls back to think when no heuristic matches", async () => {
  const result = await resolveResponseMode({
    think: true,
    message: "ok",
    token: "",
    privacyMode: "local",
  });
  assert.equal(result.mode, "think");
});

test("modeStatusLabel returns human-readable labels", () => {
  assert.equal(modeStatusLabel("code"), "Coding...");
  assert.equal(modeStatusLabel("research"), "Researching...");
});
