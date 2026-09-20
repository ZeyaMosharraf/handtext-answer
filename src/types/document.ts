/**
 * src/types/document.ts
 *
 * Core Document Block Model for HandText.
 *
 * Architectural Invariants:
 * 1. Document is an ordered sequence of typed blocks: TextBlock | MathBlock | TableBlock | GraphBlock.
 * 2. Selection, caret, and modal state are ephemeral UI/editor state, NEVER persisted in DocumentBlock.
 * 3. Stable block IDs must survive serialization, deserialization, draft restoration, and cloud sync.
 * 4. Existing Table and Graph structures are fully preserved.
 * 5. The model does NOT take over page layout — blocks compile into FlowItem[] for the A4 pagination engine.
 */

import type { TableData } from "../lib/handwriting/parse";
import type { GraphDefinition } from "../lib/graph/types";

export type BlockType = "text" | "math" | "table" | "graph";

export type MarginMarkerType = "question" | "answer" | "subquestion" | "marks" | "custom";

export interface MarginMarker {
  type: MarginMarkerType;
  text: string;
  color?: string | undefined;
}

export interface BaseBlock {
  /** Stable UUID identifying the block across edits and serialization cycles */
  id: string;
  /** Discriminant block type */
  type: BlockType;
  /** Timestamp when the block was created */
  createdAt: number;
  /** Optional academic margin marker (e.g. Q1, Ans, a), 10M) */
  marginMarker?: MarginMarker | undefined;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  /** Rich text HTML content (p, strong, em, u, span, ul, ol, blockquote, hr, etc.) */
  html: string;
}

export interface MathBlock extends BaseBlock {
  type: "math";
  /** Natural user expression (e.g. "Z1 = X1 W11 + X2 W21" or "x^2") */
  naturalExpr: string;
  /** Canonical compiled LaTeX expression (e.g. "Z_1 = X_1 W_{11} + X_2 W_{21}") */
  latex: string;
  /** Display mode: 'block' (centered display formula) or 'compact' (inline/left-aligned) */
  displayMode: "block" | "compact";
  /** Optional custom ink/color for this specific math block (e.g. "#1d3fb5") */
  color?: string | undefined;
}

export interface TableBlock extends BaseBlock {
  type: "table";
  /** HTML representation of the table element (including thead, tbody, th, td, styles, data-align) */
  html: string;
  /** Optional structured table data for layout/computation */
  tableData?: TableData | undefined;
}

export interface GraphBlock extends BaseBlock {
  type: "graph";
  /** The complete serializable graph specification */
  graphDef: GraphDefinition;
}

export type DocumentBlock = TextBlock | MathBlock | TableBlock | GraphBlock;

export interface DocumentState {
  version: 2;
  blocks: DocumentBlock[];
}

/**
 * Generates a stable, unique block ID that works across both Node and browser environments.
 */
export function generateBlockId(prefix: string = "blk"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Creates a default empty text block with a fresh stable ID.
 */
export function createEmptyTextBlock(
  html: string = "<p><br></p>",
  marginMarker?: MarginMarker | undefined
): TextBlock {
  return {
    id: generateBlockId("txt"),
    type: "text",
    html,
    ...(marginMarker !== undefined ? { marginMarker } : {}),
    createdAt: Date.now(),
  };
}

/**
 * Creates a new MathBlock with a fresh stable ID.
 */
export function createMathBlock(
  naturalExpr: string,
  latex: string,
  displayMode: "block" | "compact" = "block",
  color?: string | undefined,
  marginMarker?: MarginMarker | undefined
): MathBlock {
  return {
    id: generateBlockId("math"),
    type: "math",
    naturalExpr,
    latex,
    displayMode,
    ...(color !== undefined && color !== null ? { color } : {}),
    ...(marginMarker !== undefined ? { marginMarker } : {}),
    createdAt: Date.now(),
  };
}

/**
 * Creates a new TableBlock with a fresh stable ID.
 */
export function createTableBlock(
  html: string,
  tableData?: TableData | undefined,
  marginMarker?: MarginMarker | undefined
): TableBlock {
  return {
    id: generateBlockId("tbl"),
    type: "table",
    html,
    ...(tableData !== undefined ? { tableData } : {}),
    ...(marginMarker !== undefined ? { marginMarker } : {}),
    createdAt: Date.now(),
  };
}

/**
 * Creates a new GraphBlock with a fresh stable ID.
 */
export function createGraphBlock(
  graphDef: GraphDefinition,
  marginMarker?: MarginMarker | undefined
): GraphBlock {
  return {
    id: generateBlockId("grp"),
    type: "graph",
    graphDef,
    ...(marginMarker !== undefined ? { marginMarker } : {}),
    createdAt: Date.now(),
  };
}
