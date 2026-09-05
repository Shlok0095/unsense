import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyByHeuristics } from "../../src/agent/modeHeuristics.js";
import { resolveResponseMode, modeStatusLabel, modeIntentLabel } from "../../src/agent/modeResolver.js";
import { validateThink } from "../../src/security/validation.js";

const sources = [{ id: 1, url: "https://example.com/a", title: "Example" }];

test("classifyByHeuristics detects coding prompts", () => {
  const result = classifyByHeuristics("write a python function to sort a list");
  assert.equal(result.mode, "code");
  assert.equal(result.confidence, "high");
});

test("classifyByHeuristics does not classify reverse-engineering essay as code", () => {
  const result = classifyByHeuristics(
    "how to reverse engineer a macOS app using gdb and lldb disassembler"
  );
  assert.notEqual(result.mode, "code");
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

test("resolveResponseMode never returns fast when think is on", async () => {
  const result = await resolveResponseMode({
    think: true,
    message: "hi",
    token: "",
    privacyMode: "local",
  });
  assert.notEqual(result.mode, "fast");
  assert.equal(result.mode, "think");
});

test("modeStatusLabel and modeIntentLabel return human-readable labels", () => {
  assert.equal(modeStatusLabel("code"), "Coding...");
  assert.equal(modeIntentLabel("research"), "Research");
});

test("validateThink accepts boolean and string forms", () => {
  assert.equal(validateThink(true), true);
  assert.equal(validateThink("true"), true);
  assert.equal(validateThink("false"), false);
  assert.equal(validateThink(false), false);
});
