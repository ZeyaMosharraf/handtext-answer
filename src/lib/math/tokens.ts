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

/**
 * Tokenize a LaTeX math string into Token[].
 * Resilient: unrecognized characters become OPERATOR tokens.
 */
export function tokenize(latex: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = latex.length;

  while (i < len) {
    const ch = latex[i]!;

    // Skip whitespace (LaTeX math mode ignores spaces)
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Non-breaking space / tilde → thin space
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
      // Single non-alpha commands like \, \; \: \! \| \\ \{ \}
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
