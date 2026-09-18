/**
 * tokens.ts — LaTeX math tokenizer.
 *
 * Converts a raw LaTeX math string into a flat Token[] array.
 * Handles commands (\frac, \alpha, \leq, etc.), numbers, identifiers,
 * operators, braces, brackets, superscript/subscript markers, and pipes.
 */

export type TokenKind =
  | "COMMAND"   // \frac, \sqrt, \alpha, \log, etc.
  | "NUMBER"    // 3, 3.14, 0.5
  | "IDENT"     // x, y, S — single letter identifiers
  | "OPERATOR"  // +, -, =, *, /, <, >, !, ,, ., ;, :
  | "LBRACE"    // {
  | "RBRACE"    // }
  | "LBRACKET"  // [
  | "RBRACKET"  // ]
  | "LPAREN"    // (
  | "RPAREN"    // )
  | "SUP"       // ^
  | "SUB"       // _
  | "PIPE"      // |
  | "SPACE"     // ~ (non-breaking space in LaTeX)
  | "EOF";

export interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

function isBinaryOpToken(t?: Token): boolean {
  if (!t) return false;
  if (t.kind === "OPERATOR") {
    return t.value === "+" || t.value === "=" || t.value === "-" || t.value === "*" ||
           t.value === "/" || t.value === "<" || t.value === ">";
  }
  if (t.kind === "COMMAND") {
    return t.value === "\\geq" || t.value === "\\leq" || t.value === "\\neq" ||
           t.value === "\\approx" || t.value === "\\pm" || t.value === "\\times" ||
           t.value === "\\cdot" || t.value === "\\to" || t.value === "\\Rightarrow";
  }
  return false;
}

function nextIsBinaryOp(latex: string, idx: number): boolean {
  let k = idx;
  while (k < latex.length && /\s/.test(latex[k]!)) k++;
  if (k >= latex.length) return false;
  const c = latex[k]!;
  if (c === "+" || c === "=" || c === "*" || c === "/" || c === "<" || c === ">") return true;
  if (c === "-" && latex[k + 1] !== ">") return true;
  if (c === ">" && latex[k + 1] === "=") return true;
  if (c === "<" && latex[k + 1] === "=") return true;
  if (c === "!" && latex[k + 1] === "=") return true;
  if (c === "\\") {
    const cmd = latex.slice(k).match(/^\\[a-zA-Z]+/)?.[0];
    if (cmd && (cmd === "\\geq" || cmd === "\\leq" || cmd === "\\neq" || cmd === "\\approx" ||
                cmd === "\\pm" || cmd === "\\times" || cmd === "\\cdot" || cmd === "\\to" || cmd === "\\Rightarrow")) {
      return true;
    }
  }
  return false;
}

/**
 * Tokenize a LaTeX math string into Token[].
 * Resilient: unrecognized characters become OPERATOR tokens.
 */
export function tokenize(latex: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = latex.length;

  let afterAlphaCommand = false;

  while (i < len) {
    const ch = latex[i]!;

    // Whitespace handling:
    // In LaTeX math mode, the first space immediately following an alphabetic command
    // (like `\alpha `) acts as the command terminator.
    // Also, a single standard space adjacent to a binary operator (+, -, =, etc.) is absorbed
    // into the operator's built-in mathematical spacing (OP_SPACING_EM).
    // All other typed spaces (around punctuation, delimiters, identifiers, or multiple spaces)
    // are preserved as intentional horizontal SPACE tokens.
    if (/\s/.test(ch)) {
      let spaceCount = 0;
      const startPos = i;
      while (i < len && /\s/.test(latex[i]!)) {
        spaceCount++;
        i++;
      }

      if (afterAlphaCommand) {
        afterAlphaCommand = false;
        spaceCount--; // First space terminates the LaTeX command name
      }

      const prevToken = tokens[tokens.length - 1];
      const nextIsBin = nextIsBinaryOp(latex, i);
      const prevIsBin = isBinaryOpToken(prevToken);

      if (prevIsBin || nextIsBin) {
        spaceCount--;
      }

      for (let s = 0; s < spaceCount; s++) {
        tokens.push({ kind: "SPACE", value: " ", pos: startPos + s });
      }
      continue;
    }

    // Reset command delimiter tracking on any non-whitespace token
    afterAlphaCommand = false;

    // Non-breaking space / tilde → space
    if (ch === "~") {
      tokens.push({ kind: "SPACE", value: "~", pos: i });
      i++;
      continue;
    }

    // LaTeX command: \commandName
    if (ch === "\\") {
      if (i + 1 >= len) {
        tokens.push({ kind: "COMMAND", value: "\\", pos: i });
        i++;
        continue;
      }
      const next = latex[i + 1]!;
      // Visible braces: \{ and \}
      if (next === "{" || next === "}") {
        tokens.push({ kind: next === "{" ? "LBRACE" : "RBRACE", value: `\\${next}`, pos: i });
        i += 2;
        continue;
      }
      // Single non-alpha commands like \, \; \: \! \| \\
      if (!/[a-zA-Z]/.test(next)) {
        tokens.push({ kind: "COMMAND", value: `\\${next}`, pos: i });
        i += 2;
        continue;
      }
      // Multi-letter command
      let j = i + 1;
      while (j < len && /[a-zA-Z]/.test(latex[j]!)) {
        j++;
      }
      tokens.push({ kind: "COMMAND", value: latex.slice(i, j), pos: i });
      i = j;
      afterAlphaCommand = true;
      continue;
    }

    // Two-character relational operators commonly typed in math formulas:
    // >= (\geq), <= (\leq), != (\neq), -> (\to), => (\Rightarrow)
    if (ch === ">" && latex[i + 1] === "=") {
      tokens.push({ kind: "COMMAND", value: "\\geq", pos: i });
      i += 2;
      continue;
    }
    if (ch === "<" && latex[i + 1] === "=") {
      tokens.push({ kind: "COMMAND", value: "\\leq", pos: i });
      i += 2;
      continue;
    }
    if (ch === "!" && latex[i + 1] === "=") {
      tokens.push({ kind: "COMMAND", value: "\\neq", pos: i });
      i += 2;
      continue;
    }
    if (ch === "-" && latex[i + 1] === ">") {
      tokens.push({ kind: "COMMAND", value: "\\to", pos: i });
      i += 2;
      continue;
    }
    if (ch === "=" && latex[i + 1] === ">") {
      tokens.push({ kind: "COMMAND", value: "\\Rightarrow", pos: i });
      i += 2;
      continue;
    }

    // Number
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < len && /[0-9]/.test(latex[j]!)) j++;
      if (j < len && latex[j] === "." && j + 1 < len && /[0-9]/.test(latex[j + 1]!)) {
        j++; // decimal point
        while (j < len && /[0-9]/.test(latex[j]!)) j++;
      }
      tokens.push({ kind: "NUMBER", value: latex.slice(i, j), pos: i });
      i = j;
      continue;
    }

    // Single letter identifier
    if (/[a-zA-Z]/.test(ch)) {
      tokens.push({ kind: "IDENT", value: ch, pos: i });
      i++;
      continue;
    }

    // Special structural tokens
    if (ch === "{") { tokens.push({ kind: "LBRACE", value: "{", pos: i }); i++; continue; }
    if (ch === "}") { tokens.push({ kind: "RBRACE", value: "}", pos: i }); i++; continue; }
    if (ch === "[") { tokens.push({ kind: "LBRACKET", value: "[", pos: i }); i++; continue; }
    if (ch === "]") { tokens.push({ kind: "RBRACKET", value: "]", pos: i }); i++; continue; }
    if (ch === "(") { tokens.push({ kind: "LPAREN", value: "(", pos: i }); i++; continue; }
    if (ch === ")") { tokens.push({ kind: "RPAREN", value: ")", pos: i }); i++; continue; }
    if (ch === "^") { tokens.push({ kind: "SUP", value: "^", pos: i }); i++; continue; }
    if (ch === "_") { tokens.push({ kind: "SUB", value: "_", pos: i }); i++; continue; }
    if (ch === "|") { tokens.push({ kind: "PIPE", value: "|", pos: i }); i++; continue; }

    // Everything else is an operator
    tokens.push({ kind: "OPERATOR", value: ch, pos: i });
    i++;
  }

  tokens.push({ kind: "EOF", value: "", pos: len });
  return tokens;
}
