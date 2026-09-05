/**
 * Safe arithmetic evaluator — a hand-written recursive-descent parser, not
 * eval()/new Function(). User- and model-supplied expressions must never
 * reach a real JS evaluator, even for "just math", since that's a direct
 * arbitrary-code-execution path.
 */

const TOKEN_RE = /\s*(\d+\.?\d*|\.\d+|\*\*|[+\-*/%^()])/g;

function tokenize(expr) {
  const tokens = [];
  let match;
  let lastIndex = 0;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(expr))) {
    if (match.index !== lastIndex) {
      throw new Error(`Unexpected character near "${expr.slice(lastIndex, match.index + 1)}"`);
    }
    tokens.push(match[1]);
    lastIndex = TOKEN_RE.lastIndex;
  }
  if (lastIndex !== expr.length) {
    throw new Error(`Unexpected character near "${expr.slice(lastIndex)}"`);
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpression() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm() {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next();
      const rhs = parseUnary();
      if ((op === "/" || op === "%") && rhs === 0) throw new Error("Division by zero");
      value = op === "*" ? value * rhs : op === "/" ? value / rhs : value % rhs;
    }
    return value;
  }

  function parseUnary() {
    if (peek() === "-") {
      next();
      return -parseUnary();
    }
    if (peek() === "+") {
      next();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower() {
    const base = parseAtom();
    if (peek() === "^" || peek() === "**") {
      next();
      return Math.pow(base, parseUnary());
    }
    return base;
  }

  function parseAtom() {
    const token = next();
    if (token === undefined) throw new Error("Unexpected end of expression");
    if (token === "(") {
      const value = parseExpression();
      if (next() !== ")") throw new Error("Missing closing parenthesis");
      return value;
    }
    const num = Number(token);
    if (Number.isNaN(num)) throw new Error(`Invalid number: ${token}`);
    return num;
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new Error(`Unexpected token: ${tokens[pos]}`);
  return result;
}

export function evaluateExpression(expression) {
  const clean = String(expression || "").trim();
  if (!clean) throw new Error("No expression provided.");
  if (clean.length > 200) throw new Error("Expression too long.");
  return parse(tokenize(clean));
}

export const calculatorTool = {
  name: "calculator",
  description: "Evaluates an arithmetic expression (+ - * / % ^ and parentheses).",
  schema: { expression: "string, e.g. '(3 + 4) * 2'" },
  permissions: [],
  timeoutMs: 500,
  async handler({ expression }) {
    const value = evaluateExpression(expression);
    return { expression, value };
  },
};
