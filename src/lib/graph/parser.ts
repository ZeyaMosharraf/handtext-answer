/**
 * src/lib/graph/parser.ts
 *
 * Lightweight function expression tokenizer, recursive-descent parser, and evaluator.
 *
 * Supports:
 *   Variables:  x
 *   Constants:  pi, e
 *   Operators:  + - * / ^ (right-associative power)
 *   Functions:  sin cos tan sqrt abs log ln exp
 *   Grouping:   ( expr )
 *
 * Operator precedence (low → high):
 *   1. Additive:       + -
 *   2. Multiplicative: * /
 *   3. Unary:          -x +x
 *   4. Power:          ^ (right-associative)
 *   5. Primary:        number | x | pi | e | fn(expr) | (expr)
 *
 * Usage:
 *   const compiled = compileExpression("x^2 + 2*x + 1");
 *   const y = compiled.evaluate(3);  // → 16
 *
 * Error handling:
 *   compileExpression throws GraphParseError on invalid syntax.
 *   evaluate() returns NaN for domain errors (e.g. sqrt(-1), 1/0, tan(π/2))
 *   — it never throws at evaluation time.
 */

import { GraphParseError } from "./types";

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type Token =
  | { kind: "num"; value: number }
  | { kind: "var" }                                        // x
  | { kind: "const"; name: "pi" | "e" }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { kind: "fn"; name: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "eof" };

const SUPPORTED_FUNCTIONS = new Set([
  "sin", "cos", "tan", "sqrt", "abs", "log", "ln", "exp",
]);

/**
 * Tokenize a function expression string.
 * Throws GraphParseError on unrecognised tokens.
 */
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = expr.trim();

  while (i < src.length) {
    const ch = src[i]!;

    // Whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // Numbers: integer or decimal
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let num = "";
      while (i < src.length && ((src[i]! >= "0" && src[i]! <= "9") || src[i] === ".")) {
        num += src[i++];
      }
      const value = parseFloat(num);
      if (isNaN(value)) throw new GraphParseError(`Invalid number: "${num}"`);
      tokens.push({ kind: "num", value });
      continue;
    }

    // Identifiers: variable x, constants pi/e, function names
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      let name = "";
      while (i < src.length && ((src[i]! >= "a" && src[i]! <= "z") || (src[i]! >= "A" && src[i]! <= "Z") || src[i] === "_")) {
        name += src[i++];
      }
      if (name === "x") {
        tokens.push({ kind: "var" });
      } else if (name === "pi") {
        tokens.push({ kind: "const", name: "pi" });
      } else if (name === "e") {
        tokens.push({ kind: "const", name: "e" });
      } else if (SUPPORTED_FUNCTIONS.has(name)) {
        tokens.push({ kind: "fn", name });
      } else {
        // Treat unknown identifiers as variable x (graceful degradation)
        // or throw if clearly wrong
        throw new GraphParseError(`Unknown identifier: "${name}". Supported functions: ${[...SUPPORTED_FUNCTIONS].join(", ")}`);
      }
      continue;
    }

    // Operators and parentheses
    switch (ch) {
      case "+": tokens.push({ kind: "op", value: "+" }); i++; break;
      case "-": tokens.push({ kind: "op", value: "-" }); i++; break;
      case "*": tokens.push({ kind: "op", value: "*" }); i++; break;
      case "/": tokens.push({ kind: "op", value: "/" }); i++; break;
      case "^": tokens.push({ kind: "op", value: "^" }); i++; break;
      case "(": tokens.push({ kind: "lparen" }); i++; break;
      case ")": tokens.push({ kind: "rparen" }); i++; break;
      default:
        throw new GraphParseError(`Unexpected character: "${ch}" at position ${i}`);
    }
  }

  tokens.push({ kind: "eof" });
  return tokens;
}

// ─── AST ─────────────────────────────────────────────────────────────────────

type ExprNode =
  | { kind: "num"; value: number }
  | { kind: "var" }
  | { kind: "const"; name: "pi" | "e" }
  | { kind: "binop"; op: "+" | "-" | "*" | "/" | "^"; left: ExprNode; right: ExprNode }
  | { kind: "unary"; op: "+" | "-"; arg: ExprNode }
  | { kind: "fn"; name: string; arg: ExprNode };

// ─── Parser (recursive descent) ──────────────────────────────────────────────

interface ParseState {
  tokens: Token[];
  pos: number;
}

function peek(state: ParseState): Token {
  return state.tokens[state.pos] ?? { kind: "eof" };
}

function consume(state: ParseState): Token {
  const t = state.tokens[state.pos] ?? { kind: "eof" };
  state.pos++;
  return t;
}

function expect(state: ParseState, kind: Token["kind"]): Token {
  const t = consume(state);
  if (t.kind !== kind) {
    throw new GraphParseError(`Expected ${kind} but got ${t.kind}`);
  }
  return t;
}

/** expr = term (('+' | '-') term)* */
function parseExpr(state: ParseState): ExprNode {
  let left = parseTerm(state);
  while (true) {
    const t = peek(state);
    if (t.kind === "op" && (t.value === "+" || t.value === "-")) {
      consume(state);
      const right = parseTerm(state);
      left = { kind: "binop", op: t.value, left, right };
    } else {
      break;
    }
  }
  return left;
}

/** term = unary (('*' | '/') unary)* */
function parseTerm(state: ParseState): ExprNode {
  let left = parseUnary(state);
  while (true) {
    const t = peek(state);
    if (t.kind === "op" && (t.value === "*" || t.value === "/")) {
      consume(state);
      const right = parseUnary(state);
      left = { kind: "binop", op: t.value, left, right };
    } else {
      break;
    }
  }
  return left;
}

/** unary = ('-' | '+') unary | power */
function parseUnary(state: ParseState): ExprNode {
  const t = peek(state);
  if (t.kind === "op" && (t.value === "-" || t.value === "+")) {
    consume(state);
    const arg = parseUnary(state);
    return t.value === "-" ? { kind: "unary", op: "-", arg } : arg;
  }
  return parsePower(state);
}

/** power = primary ('^' unary)? — right-associative */
function parsePower(state: ParseState): ExprNode {
  const base = parsePrimary(state);
  const t = peek(state);
  if (t.kind === "op" && t.value === "^") {
    consume(state);
    // Right-associative: parse unary (not power) as the exponent
    // This makes -x^2 = -(x^2) correct since unary is above power in chain
    const exp = parseUnary(state);
    return { kind: "binop", op: "^", left: base, right: exp };
  }
  return base;
}

/** primary = number | 'x' | 'pi' | 'e' | fn '(' expr ')' | '(' expr ')' */
function parsePrimary(state: ParseState): ExprNode {
  const t = peek(state);

  if (t.kind === "num") {
    consume(state);
    return { kind: "num", value: t.value };
  }

  if (t.kind === "var") {
    consume(state);
    return { kind: "var" };
  }

  if (t.kind === "const") {
    consume(state);
    return { kind: "const", name: t.name };
  }

  if (t.kind === "fn") {
    consume(state);
    expect(state, "lparen");
    const arg = parseExpr(state);
    expect(state, "rparen");
    return { kind: "fn", name: t.name, arg };
  }

  if (t.kind === "lparen") {
    consume(state);
    const node = parseExpr(state);
    expect(state, "rparen");
    return node;
  }

  if (t.kind === "eof") {
    throw new GraphParseError("Unexpected end of expression");
  }

  throw new GraphParseError(`Unexpected token: ${t.kind}`);
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

/**
 * Evaluate an AST node at a given x value.
 * Never throws — returns NaN for domain errors (sqrt(-1), 1/0, etc.).
 */
function evaluateNode(node: ExprNode, x: number): number {
  switch (node.kind) {
    case "num":   return node.value;
    case "var":   return x;
    case "const": return node.name === "pi" ? Math.PI : Math.E;

    case "unary":
      return node.op === "-" ? -evaluateNode(node.arg, x) : evaluateNode(node.arg, x);

    case "binop": {
      const l = evaluateNode(node.left, x);
      const r = evaluateNode(node.right, x);
      switch (node.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return r === 0 ? (l === 0 ? NaN : l > 0 ? Infinity : -Infinity) : l / r;
        case "^": return Math.pow(l, r);
        default:  return NaN;
      }
    }

    case "fn": {
      const v = evaluateNode(node.arg, x);
      switch (node.name) {
        case "sin":  return Math.sin(v);
        case "cos":  return Math.cos(v);
        case "tan":  return Math.tan(v);
        case "sqrt": return Math.sqrt(v);    // NaN for negative
        case "abs":  return Math.abs(v);
        case "log":  return Math.log10(v);   // NaN for negative, -Inf for 0
        case "ln":   return Math.log(v);     // NaN for negative, -Inf for 0
        case "exp":  return Math.exp(v);
        default:     return NaN;
      }
    }

    default: return NaN;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CompiledExpression {
  evaluate(x: number): number;
}

/**
 * Parse and compile a function expression string into an evaluatable object.
 *
 * @param expr  Expression string, e.g. "x^2", "sin(x)", "2*x+1"
 * @returns     CompiledExpression with evaluate(x) method
 * @throws      GraphParseError if the expression is syntactically invalid
 */
export function compileExpression(expr: string): CompiledExpression {
  if (!expr || !expr.trim()) {
    throw new GraphParseError("Empty expression");
  }
  const tokens = tokenize(expr.trim());
  const state: ParseState = { tokens, pos: 0 };
  const ast = parseExpr(state);

  // Ensure we consumed all tokens (trailing garbage = error)
  const remaining = peek(state);
  if (remaining.kind !== "eof") {
    throw new GraphParseError(`Unexpected token after expression: ${remaining.kind}`);
  }

  return {
    evaluate(x: number): number {
      return evaluateNode(ast, x);
    },
  };
}
