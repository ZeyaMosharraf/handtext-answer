/**
 * index.ts — Public API for the math subsystem.
 *
 * Consumer modules (parse.ts, layout.ts, renderer.ts, MathFormulaModal.tsx)
 * should import only from this file, never from internal modules directly.
 */

export { parseMath } from "./parser";
export { layoutMath, computeLineUnits } from "./layout";
export { hasGlyph, drawGlyph, GLYPH_MAP } from "./glyphs";
export type {
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
  MathLayoutBox,
  MathBlockData,
} from "./types";
