import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateExpression } from "../../src/tools/calculator.js";

test("evaluates basic arithmetic with correct precedence", () => {
  assert.equal(evaluateExpression("2 + 3 * 4"), 14);
  assert.equal(evaluateExpression("(2 + 3) * 4"), 20);
  assert.equal(evaluateExpression("10 / 4"), 2.5);
  assert.equal(evaluateExpression("2 ^ 10"), 1024);
  assert.equal(evaluateExpression("-5 + 3"), -2);
  assert.equal(evaluateExpression("7 % 3"), 1);
});

test("rejects division by zero", () => {
  assert.throws(() => evaluateExpression("1 / 0"), /zero/i);
});

test("rejects anything that isn't a pure arithmetic expression", () => {
  assert.throws(() => evaluateExpression("process.exit(1)"));
  assert.throws(() => evaluateExpression("1; console.log(1)"));
  assert.throws(() => evaluateExpression("require('fs')"));
  assert.throws(() => evaluateExpression("2 +"));
  assert.throws(() => evaluateExpression(""));
});
