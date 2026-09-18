/**
 * types.ts — Math AST node definitions and layout box interface.
 *
 * MathNode: The union type for all mathematical AST node types.
 * MathLayoutBox: The 2D bounding box produced by the layout engine.
 *
 * pen.ts never sees these types. All math semantics are confined to src/lib/math/.
 */

import type { HandwritingSettings } from "../handwriting/types";

// ─── Math AST ────────────────────────────────────────────────────────────────

/** A numeric literal, e.g. "3", "3.14" */
export interface NumberNode {
  type: "number";
  value: string;
}

/** A variable or identifier — rendered italic by convention, e.g. "x", "y", "S" */
export interface IdentifierNode {
  type: "identifier";
  value: string;
}

/** A binary, unary, or relational operator, e.g. "+", "-", "=", "±" */
export interface OperatorNode {
  type: "operator";
  value: string;
}

/**
 * A mathematical symbol that may not be in the handwriting font's character set.
 * Greek letters and special operators use vector glyph paths from glyphs.ts.
 */
export interface SymbolNode {
  type: "symbol";
  /** The actual Unicode character, e.g. "α", "Σ", "∫" */
  symbol: string;
  /** LaTeX command name without backslash, e.g. "alpha", "Sigma", "int" */
  name: string;
}

/** A fraction: \frac{numerator}{denominator} */
export interface FractionNode {
  type: "fraction";
  numerator: MathNode[];
  denominator: MathNode[];
}

/**
 * Superscript and/or subscript on a base expression.
 * e.g. x^2 (sup), x_1 (sub), x_1^2 (both), \log_2 (function with sub)
 */
export interface SupSubNode {
  type: "supsub";
  base: MathNode[];
  sup?: MathNode[];
  sub?: MathNode[];
}

/** A square root or n-th root: \sqrt{x}, \sqrt[3]{8} */
export interface RootNode {
  type: "root";
  radicand: MathNode[];
  index?: MathNode[]; // Optional n-th root index
}

/** A named mathematical function: \log, \ln, \sin, \cos, \tan, \text */
export interface FunctionNode {
  type: "function";
  name: string;
  arg?: MathNode[];
}

/** A delimited group: (expr), [expr], {expr}, |expr| with optional \left/\right stretching */
export interface GroupedNode {
  type: "grouped";
  open: "(" | "[" | "{" | "|" | "";
  close: ")" | "]" | "}" | "|" | "";
  body: MathNode[];
}

/**
 * Large operators with optional limits: Σ, Π, ∫
 * e.g. \sum_{i=0}^{n}, \int_a^b
 */
export interface BigOpNode {
  type: "bigOp";
  operator: "sum" | "prod" | "integral" | "oint";
  lower?: MathNode[];
  upper?: MathNode[];
  operand?: MathNode[];
}

/** Explicit whitespace: \quad, \;, \,  */
export interface SpaceNode {
  type: "space";
  widthEm: number;
}

export type MathNode =
  | NumberNode
  | IdentifierNode
  | OperatorNode
  | SymbolNode
  | FractionNode
  | SupSubNode
  | RootNode
  | FunctionNode
  | GroupedNode
  | BigOpNode
  | SpaceNode;

// ─── Math Layout Box ─────────────────────────────────────────────────────────

export interface MathLayoutBox {
  /** Node type for debugging */
  type: string;
  /** Horizontal extent in canvas pixels */
  width: number;
  /** Height above baseline in canvas pixels */
  ascent: number;
  /** Depth below baseline in canvas pixels */
  descent: number;
  /**
   * Draw this box at (originX, baselineY).
   * All canvas operations use pen.ts primitives: writeSegments, inkLine, bezierCurveTo.
   */
  draw: (
    ctx: CanvasRenderingContext2D,
    originX: number,
    baselineY: number,
    settings: HandwritingSettings,
    random: () => number,
    ink: string,
  ) => void;
  /** Child boxes with their positions relative to (originX, baselineY) — for debugging */
  children?: Array<{ box: MathLayoutBox; dx: number; dy: number }>;
}

// ─── Math Block Data ─────────────────────────────────────────────────────────

/** Stored in Block.math when kind === "math" */
export interface MathBlockData {
  latex: string;
  ast: MathNode[];
  display: "block" | "inline";
}

// ─── Re-exported HandwritingSettings alias for use within math module ────────
export type { HandwritingSettings };
