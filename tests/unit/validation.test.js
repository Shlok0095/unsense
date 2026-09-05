import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateMessage,
  validateHistory,
  validateDocumentChunks,
  validateMode,
  validatePrivacyMode,
  ValidationError,
  LIMITS,
} from "../../src/security/validation.js";

test("validateMessage rejects empty/whitespace-only input", () => {
  assert.throws(() => validateMessage(""), ValidationError);
  assert.throws(() => validateMessage("   "), ValidationError);
  assert.throws(() => validateMessage(undefined), ValidationError);
});

test("validateMessage rejects an oversized message", () => {
  const huge = "a".repeat(LIMITS.MAX_MESSAGE_CHARS + 1);
  assert.throws(() => validateMessage(huge), ValidationError);
});

test("validateMessage trims and accepts a normal message", () => {
  assert.equal(validateMessage("  hello  "), "hello");
});

test("validateHistory drops malformed entries and enforces role/content shape", () => {
  const history = validateHistory([
    { role: "user", content: "hi" },
    { role: "system", content: "should be dropped" },
    { role: "assistant", content: 123 },
    null,
    { role: "assistant", content: "ok" },
  ]);
  assert.deepEqual(history, [
    { role: "user", content: "hi" },
    { role: "assistant", content: "ok" },
  ]);
});

test("validateHistory rejects a non-array", () => {
  assert.throws(() => validateHistory("not an array"), ValidationError);
});

test("validateHistory rejects an excessively long history", () => {
  const long = Array.from({ length: LIMITS.MAX_HISTORY_MESSAGES + 1 }, () => ({
    role: "user",
    content: "x",
  }));
  assert.throws(() => validateHistory(long), ValidationError);
});

test("validateDocumentChunks caps count and per-chunk size, drops malformed entries", () => {
  const chunks = validateDocumentChunks([
    { chunkId: "a", text: "x".repeat(5000) },
    { chunkId: "b" }, // no text -> dropped
    { text: "no chunkId" }, // dropped
  ]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text.length, 4000);
});

test("validateMode falls back to fast for unknown/invalid values", () => {
  assert.equal(validateMode("research"), "research");
  assert.equal(validateMode("nonsense"), "fast");
  assert.equal(validateMode(undefined), "fast");
});

test("validatePrivacyMode falls back to normal for unknown values", () => {
  assert.equal(validatePrivacyMode("local"), "local");
  assert.equal(validatePrivacyMode("nonsense"), "normal");
});
