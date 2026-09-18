/**
 * parser.ts — Recursive-descent LaTeX math parser.
 *
 * Converts Token[] into MathNode[] AST.
 * Error resilient: unknown commands → IdentifierNode, unclosed braces → consume rest.
 * Never throws. Always produces a valid, renderable AST.
 */

import type {
  MathNode,
  NumberNode,
  IdentifierNode,
  OperatorNode,
  SymbolNode,
  FractionNode,
  SupSubNode,
  RootNode,
  FunctionNode,
  GroupedNode,
  BigOpNode,
  SpaceNode,
  MatrixNode,
  MatrixEnvironment,
} from "./types";
import { tokenize, type Token, type TokenKind } from "./tokens";

// ─── Greek & Symbol Mappings ──────────────────────────────────────────────────

const GREEK_LOWER: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ",
  nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", chi: "χ", psi: "ψ", omega: "ω", varepsilon: "ε", varphi: "φ",
  vartheta: "θ", varrho: "ρ", varsigma: "ς",
};

const GREEK_UPPER: Record<string, string> = {
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

const SPECIAL_SYMBOLS: Record<string, string> = {
  leq: "≤", geq: "≥", neq: "≠", approx: "≈", infty: "∞",
  partial: "∂", nabla: "∇", cdot: "·", times: "×", div: "÷",
  pm: "±", mp: "∓", ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱",
  in: "∈", notin: "∉", subset: "⊂", supset: "⊃", cap: "∩", cup: "∪",
  forall: "∀", exists: "∃", neg: "¬", wedge: "∧", vee: "∨",
  to: "→", leftarrow: "←", rightarrow: "→", Leftarrow: "⇐", Rightarrow: "⇒",
  leftrightarrow: "↔", Leftrightarrow: "⟺",
  ll: "≪", gg: "≫", sim: "∼", simeq: "≃", equiv: "≡", propto: "∝",
  perp: "⊥", parallel: "∥", angle: "∠", triangle: "△",
  therefore: "∴", because: "∵",
  sqrt: "√", // standalone radical
  langle: "⟨", rangle: "⟩",
  lceil: "⌈", rceil: "⌉", lfloor: "⌊", rfloor: "⌋",
  // Currency / misc
  hbar: "ℏ", ell: "ℓ", Re: "ℜ", Im: "ℑ",
};

const NAMED_FUNCTIONS = new Set([
  "log", "ln", "lg", "sin", "cos", "tan", "sec", "csc", "cot",
  "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "lim", "max", "min", "sup", "inf", "exp", "deg", "det",
  "Pr", "dim", "ker", "gcd", "lcm", "arg", "sgn", "text",
]);

const SPACE_WIDTHS: Record<string, number> = {
  "\\,": 0.17, "\\;": 0.28, "\\:": 0.22, "\\!": -0.17,
  "\\quad": 1.0, "\\qquad": 2.0, "\\ ": 0.33,
};

const MATRIX_ENVS = new Set([
  "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "array",
]);

// ─── Parser State ─────────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { kind: "EOF", value: "", pos: 0 };
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    if (t && t.kind !== "EOF") this.pos++;
    return t ?? { kind: "EOF", value: "", pos: 0 };
  }

  private expect(kind: TokenKind): Token {
    const t = this.peek();
    if (t.kind === kind) return this.consume();
    // Resilient: return a synthetic token
    return { kind, value: "", pos: t.pos };
  }

  private atEnd(): boolean {
    return this.peek().kind === "EOF";
  }

  // ── Group parsing ─────────────────────────────────────────────────────────

  /** Parse a brace group { ... } → MathNode[] */
  private parseBraceGroup(): MathNode[] {
    return this.parseBraceGroupWithStatus().body;
  }

  private parseBraceGroupWithStatus(): { body: MathNode[]; closed: boolean } {
    const t = this.peek();
    if (t.kind !== "LBRACE") {
      // Single token shortcut: \frac12 means \frac{1}{2}
      const node = this.parseSingleToken();
      return { body: node ? [node] : [], closed: false };
    }
    this.consume(); // {
    const nodes: MathNode[] = [];
    while (!this.atEnd() && this.peek().kind !== "RBRACE") {
      const node = this.parseNode();
      if (node) nodes.push(node);
    }
    const closed = this.peek().kind === "RBRACE";
    if (closed) this.consume(); // }
    return { body: nodes, closed };
  }

  /** Parse a bracket group [ ... ] → MathNode[] (for optional sqrt index) */
  private parseBracketGroup(): MathNode[] {
    this.consume(); // [
    const nodes: MathNode[] = [];
    while (!this.atEnd() && this.peek().kind !== "RBRACKET") {
      const node = this.parseNode();
      if (node) nodes.push(node);
    }
    if (this.peek().kind === "RBRACKET") this.consume(); // ]
    return nodes;
  }

  /** Parse until a closing \right command or end */
  private parseUntilRight(): MathNode[] {
    const nodes: MathNode[] = [];
    while (!this.atEnd()) {
      const t = this.peek();
      if (t.kind === "COMMAND" && t.value === "\\right") break;
      if (t.kind === "RPAREN" || t.kind === "RBRACKET" || t.kind === "RBRACE") break;
      const node = this.parseNode();
      if (node) nodes.push(node);
    }
    return nodes;
  }

  /** Parse environment name inside { ... } */
  private parseEnvironmentName(): string {
    const t = this.peek();
    if (t.kind === "LBRACE") {
      this.consume();
      let name = "";
      while (!this.atEnd() && this.peek().kind !== "RBRACE") {
        name += this.consume().value;
      }
      if (this.peek().kind === "RBRACE") {
        this.consume();
      }
      return name.trim();
    }
    if (t.kind === "IDENT") {
      let name = "";
      while (!this.atEnd() && this.peek().kind === "IDENT") {
        name += this.consume().value;
      }
      return name.trim();
    }
    return "";
  }

  private isMatrixEnd(env: string): boolean {
    const t = this.peek();
    if (t.kind !== "COMMAND" || t.value !== "\\end") return false;
    let idx = this.pos + 1;
    if (this.tokens[idx]?.kind !== "LBRACE") return false;
    idx++;
    let endEnv = "";
    while (idx < this.tokens.length && this.tokens[idx]?.kind !== "RBRACE") {
      endEnv += this.tokens[idx]!.value;
      idx++;
    }
    endEnv = endEnv.trim();
    return endEnv === env || (env === "matrix" && (endEnv === "array" || endEnv.includes("matrix"))) || (env === "bmatrix" && endEnv.includes("matrix"));
  }

  private trimCellNodes(nodes: MathNode[]): MathNode[] {
    let start = 0;
    while (start < nodes.length && nodes[start]!.type === "space") {
      start++;
    }
    let end = nodes.length;
    while (end > start && nodes[end - 1]!.type === "space") {
      end--;
    }
    return nodes.slice(start, end);
  }

  private parseMatrix(env: MatrixEnvironment): MathNode {
    const rows: MathNode[][][] = [];
    let currentRow: MathNode[][] = [];
    let currentCell: MathNode[] = [];

    while (!this.atEnd() && !this.isMatrixEnd(env)) {
      const t = this.peek();

      // Check for cell delimiter &
      if (t.kind === "OPERATOR" && t.value === "&") {
        this.consume();
        currentRow.push(this.trimCellNodes(currentCell));
        currentCell = [];
        continue;
      }

      // Check for row delimiter \\
      if (t.kind === "COMMAND" && t.value === "\\\\") {
        this.consume();
        currentRow.push(this.trimCellNodes(currentCell));
        rows.push(currentRow);
        currentRow = [];
        currentCell = [];
        continue;
      }

      // If generic \end is reached, exit matrix
      if (t.kind === "COMMAND" && t.value === "\\end") {
        break;
      }

      const node = this.parseNode();
      if (node) {
        currentCell.push(node);
      }
    }

    // Push final cell and row (ignoring purely whitespace cells if currentRow is empty)
    const trimmedLastCell = this.trimCellNodes(currentCell);
    if (trimmedLastCell.length > 0 || currentRow.length > 0) {
      currentRow.push(trimmedLastCell);
      rows.push(currentRow);
    }

    // Consume \end and {env}
    if (this.peek().kind === "COMMAND" && this.peek().value === "\\end") {
      this.consume();
      this.parseEnvironmentName();
    }

    // Normalize rows: ensure all rows have the same number of columns
    const maxCols = Math.max(1, ...rows.map((r) => r.length));
    const normalizedRows = rows.map((r) => {
      const padded = [...r];
      while (padded.length < maxCols) {
        padded.push([]);
      }
      return padded;
    });

    if (normalizedRows.length === 0) {
      normalizedRows.push([[]]);
    }

    return this.maybeSupSub([{
      type: "matrix",
      environment: env,
      rows: normalizedRows,
    } as MatrixNode]);
  }

  // ── Single token parsing ──────────────────────────────────────────────────

  /** Parse exactly one non-supsub token, no grouping */
  private parseSingleToken(): MathNode | null {
    const t = this.peek();
    if (t.kind === "NUMBER") {
      this.consume();
      return { type: "number", value: t.value } as NumberNode;
    }
    if (t.kind === "IDENT") {
      this.consume();
      return { type: "identifier", value: t.value } as IdentifierNode;
    }
    return null;
  }

  // ── Primary node parsing ──────────────────────────────────────────────────

  private parseNode(): MathNode | null {
    const t = this.peek();

    // Spaces: user typed space or ~
    if (t.kind === "SPACE") {
      this.consume();
      return { type: "space", widthEm: 0.38 } as SpaceNode;
    }

    // Numbers
    if (t.kind === "NUMBER") {
      this.consume();
      return this.maybeSupSub([{ type: "number", value: t.value } as NumberNode]);
    }

    // Single-letter identifier
    if (t.kind === "IDENT") {
      this.consume();
      return this.maybeSupSub([{ type: "identifier", value: t.value } as IdentifierNode]);
    }

    // Operators: +, -, =, <, >, etc.
    if (t.kind === "OPERATOR") {
      this.consume();
      return { type: "operator", value: t.value } as OperatorNode;
    }

    // Pipe |
    if (t.kind === "PIPE") {
      this.consume();
      return { type: "operator", value: "|" } as OperatorNode;
    }

    // Parenthesized group
    if (t.kind === "LPAREN") {
      this.consume();
      const body: MathNode[] = [];
      while (!this.atEnd() && this.peek().kind !== "RPAREN") {
        const n = this.parseNode();
        if (n) body.push(n);
      }
      if (this.peek().kind === "RPAREN") this.consume();
      return this.maybeSupSub([{ type: "grouped", open: "(", close: ")", body } as GroupedNode]);
    }

    // Bracket group [ ... ] at top level (rare outside sqrt index)
    if (t.kind === "LBRACKET") {
      const nodes = this.parseBracketGroup();
      return this.maybeSupSub([{ type: "grouped", open: "[", close: "]", body: nodes } as GroupedNode]);
    }

    // Brace group { ... } at top level
    if (t.kind === "LBRACE") {
      const { body, closed } = this.parseBraceGroupWithStatus();
      return this.maybeSupSub([{ type: "grouped", open: "{", close: closed ? "}" : "", body } as GroupedNode]);
    }

    // LaTeX command
    if (t.kind === "COMMAND") {
      return this.parseCommand();
    }

    // Superscript / Subscript directly (e.g. after a closing brace)
    if (t.kind === "SUP" || t.kind === "SUB") {
      return this.parseSupSubStandalone();
    }

    return null;
  }

  /** Handle ^ or _ that appears without an explicit base (edge case) */
  private parseSupSubStandalone(): MathNode {
    return this.maybeSupSub([{ type: "identifier", value: "" } as IdentifierNode])!;
  }

  /**
   * After parsing a base node list, check for ^ or _ to wrap in SupSubNode.
   */
  private maybeSupSub(base: MathNode[]): MathNode {
    let sup: MathNode[] | undefined;
    let sub: MathNode[] | undefined;

    // Consume any combination of ^ and _ in any order
    for (let i = 0; i < 2; i++) {
      const t = this.peek();
      if (t.kind === "SUP" && !sup) {
        this.consume();
        sup = this.parseBraceGroup();
      } else if (t.kind === "SUB" && !sub) {
        this.consume();
        sub = this.parseBraceGroup();
      } else {
        break;
      }
    }

    if (!sup && !sub) {
      return base.length === 1 ? base[0]! : { type: "grouped", open: "", close: "", body: base } as GroupedNode;
    }

    return { type: "supsub", base, sup, sub } as SupSubNode;
  }

  private parseCommand(): MathNode | null {
    const t = this.consume();
    const cmd = t.value; // includes the backslash, e.g. "\\frac"
    const name = cmd.slice(1); // e.g. "frac"

    // ── Spacing commands ────────────────────────────────────────────────────
    if (SPACE_WIDTHS[cmd] !== undefined) {
      return { type: "space", widthEm: SPACE_WIDTHS[cmd]! } as SpaceNode;
    }

    // ── Fractions ───────────────────────────────────────────────────────────
    if (name === "frac" || name === "dfrac" || name === "tfrac") {
      const num = this.parseBraceGroup();
      const den = this.parseBraceGroup();
      return this.maybeSupSub([{ type: "fraction", numerator: num, denominator: den } as FractionNode]);
    }

    // ── Square root ─────────────────────────────────────────────────────────
    if (name === "sqrt") {
      let index: MathNode[] | undefined;
      if (this.peek().kind === "LBRACKET") {
        index = this.parseBracketGroup();
      }
      const radicand = this.parseBraceGroup();
      return this.maybeSupSub([{ type: "root", radicand, index } as RootNode]);
    }

    // ── \left ... \right ────────────────────────────────────────────────────
    if (name === "left") {
      const delimToken = this.peek();
      let open: GroupedNode["open"] = "(";
      if (delimToken.kind === "LPAREN") { this.consume(); open = "("; }
      else if (delimToken.kind === "LBRACKET") { this.consume(); open = "["; }
      else if (delimToken.kind === "LBRACE") { this.consume(); open = "{"; }
      else if (delimToken.kind === "PIPE") { this.consume(); open = "|"; }
      else if (delimToken.kind === "COMMAND" && delimToken.value === "\\{") { this.consume(); open = "{"; }
      else if (delimToken.kind === "COMMAND" && delimToken.value === "\\|") { this.consume(); open = "|"; }
      else if (delimToken.kind === "COMMAND" && delimToken.value === "\\.") { this.consume(); open = ""; }

      const body = this.parseUntilRight();

      // Consume \right
      if (this.peek().kind === "COMMAND" && this.peek().value === "\\right") {
        this.consume(); // \right
        const closeToken = this.peek();
        let close: GroupedNode["close"] = ")";
        if (closeToken.kind === "RPAREN") { this.consume(); close = ")"; }
        else if (closeToken.kind === "RBRACKET") { this.consume(); close = "]"; }
        else if (closeToken.kind === "RBRACE") { this.consume(); close = "}"; }
        else if (closeToken.kind === "PIPE") { this.consume(); close = "|"; }
        else if (closeToken.kind === "COMMAND" && closeToken.value === "\\}") { this.consume(); close = "}"; }
        else if (closeToken.kind === "COMMAND" && closeToken.value === "\\|") { this.consume(); close = "|"; }
        else if (closeToken.kind === "COMMAND" && closeToken.value === "\\.") { this.consume(); close = ""; }

        return this.maybeSupSub([{ type: "grouped", open, close, body } as GroupedNode]);
      }

      return this.maybeSupSub([{ type: "grouped", open, close: open === "(" ? ")" : open === "[" ? "]" : open === "{" ? "}" : "", body } as GroupedNode]);
    }

    // Skip \right without matching \left (resilient)
    if (name === "right") {
      this.consume(); // skip delimiter
      return null;
    }

    // ── Big operators ────────────────────────────────────────────────────────
    if (name === "sum") {
      return this.parseBigOp("sum");
    }
    if (name === "prod") {
      return this.parseBigOp("prod");
    }
    if (name === "int") {
      return this.parseBigOp("integral");
    }
    if (name === "oint") {
      return this.parseBigOp("oint");
    }

    // ── Named functions ──────────────────────────────────────────────────────
    if (NAMED_FUNCTIONS.has(name)) {
      // \text{...} → plain text group rendered upright
      if (name === "text") {
        const inner = this.parseBraceGroup();
        return this.maybeSupSub([{ type: "function", name: "text", arg: inner } as FunctionNode]);
      }
      return this.maybeSupSub([{ type: "function", name } as FunctionNode]);
    }

    // ── Greek letters ────────────────────────────────────────────────────────
    const greekLower = GREEK_LOWER[name];
    if (greekLower) {
      return this.maybeSupSub([{ type: "symbol", symbol: greekLower, name } as SymbolNode]);
    }
    const greekUpper = GREEK_UPPER[name];
    if (greekUpper) {
      return this.maybeSupSub([{ type: "symbol", symbol: greekUpper, name } as SymbolNode]);
    }

    // ── Special symbols ──────────────────────────────────────────────────────
    const special = SPECIAL_SYMBOLS[name];
    if (special) {
      return this.maybeSupSub([{ type: "symbol", symbol: special, name } as SymbolNode]);
    }

    // ── \not\leq → negation ──────────────────────────────────────────────────
    if (name === "not") {
      const next = this.parseNode();
      if (next) {
        // Return as identifier with strike — for now, just return the next node
        return next;
      }
      return null;
    }

    // ── Environments (\begin{...} ... \end{...}) ────────────────────────────
    if (name === "begin") {
      const envName = this.parseEnvironmentName();
      if (envName === "array") {
        if (this.peek().kind === "LBRACE") {
          this.parseEnvironmentName(); // column specifier {cc}
        }
        return this.parseMatrix("matrix");
      }
      if (MATRIX_ENVS.has(envName)) {
        return this.parseMatrix(envName as MatrixEnvironment);
      }
      return this.maybeSupSub([{ type: "identifier", value: `\\begin{${envName}}` } as IdentifierNode]);
    }

    if (name === "end") {
      this.parseEnvironmentName();
      return null;
    }

    // ── Unknown command → fallback IdentifierNode ────────────────────────────
    return this.maybeSupSub([{ type: "identifier", value: cmd } as IdentifierNode]);
  }

  private parseBigOp(operator: BigOpNode["operator"]): MathNode {
    let lower: MathNode[] | undefined;
    let upper: MathNode[] | undefined;

    // Consume optional _ and ^ limits in any order
    for (let i = 0; i < 2; i++) {
      const t = this.peek();
      if (t.kind === "SUB" && !lower) {
        this.consume();
        lower = this.parseBraceGroup();
      } else if (t.kind === "SUP" && !upper) {
        this.consume();
        upper = this.parseBraceGroup();
      } else {
        break;
      }
    }

    return { type: "bigOp", operator, lower, upper } as BigOpNode;
  }

  // ── Top-level parse ───────────────────────────────────────────────────────

  parseExpression(): MathNode[] {
    const nodes: MathNode[] = [];
    while (!this.atEnd()) {
      const node = this.parseNode();
      if (node) nodes.push(node);
    }
    return nodes;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a LaTeX math string into a MathNode[] AST.
 * Never throws — resilient to unknown commands and malformed input.
 */
export function parseMath(latex: string): MathNode[] {
  const tokens = tokenize(latex.trim());
  const parser = new Parser(tokens);
  return parser.parseExpression();
}
