/**
 * src/lib/graph/types.ts
 *
 * All TypeScript types for the handwritten graph subsystem.
 *
 * Zero logic. Zero imports from other graph files.
 * HandwritingSettings imported from ../handwriting/types for draw() signatures.
 *
 * Design invariants:
 *   - GraphDefinition is the authoritative graph specification (stored as JSON in DOM)
 *   - GraphLayoutBox is the computed rendering contract (draw() + dimensions)
 *   - CoordTransform maps graph-space ↔ canvas-space
 *   - Randomness is passed in — geometry is deterministic
 */

import type { HandwritingSettings } from "../handwriting/types";

// ─── Graph input definition ──────────────────────────────────────────────────

/** The four supported graph types. */
export type GraphType = "coordinate" | "function" | "points" | "scatter";

/** A function to plot, e.g. y = x^2 */
export interface GraphFunctionDef {
  /** Function expression string, e.g. "x^2", "sin(x)", "2*x+1" */
  expression: string;
  /** Optional label rendered near the curve endpoint, e.g. "y = x²" */
  label?: string;
  /** Optional ink colour override (hex), defaults to document ink colour */
  color?: string;
}

/** A single explicit data point */
export interface GraphPointDef {
  x: number;
  y: number;
  /** Optional label rendered near the point, e.g. "(2,4)" */
  label?: string;
  /** If true, draw a line from the previous point to this one (line graph) */
  connect: boolean;
}

/** A free-text annotation anchored to a graph coordinate */
export interface GraphAnnotation {
  x: number;
  y: number;
  text: string;
}

/** The Cartesian coordinate space configuration */
export interface GraphCoordinateSpace {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Explicit x-axis tick interval (auto-computed if omitted) */
  xStep?: number;
  /** Explicit y-axis tick interval (auto-computed if omitted) */
  yStep?: number;
  /** Draw light hand-drawn grid lines */
  showGrid: boolean;
  /** Draw x and y axis labels */
  showAxisLabels: boolean;
  /** Whether the origin (0,0) is expected to be visible */
  originVisible: boolean;
}

/**
 * The complete, serializable graph specification.
 * Stored as JSON in data-graph-definition="..." attribute.
 */
export interface GraphDefinition {
  /** Stable UUID — used to seed PRNG for deterministic jitter across renders */
  id: string;
  type: GraphType;
  /** Optional title rendered above the graph area */
  title?: string;
  /** X-axis label (e.g. "x") */
  xLabel?: string;
  /** Y-axis label (e.g. "y") */
  yLabel?: string;
  space: GraphCoordinateSpace;
  /** Function curves to plot (function / coordinate graph types) */
  functions?: GraphFunctionDef[];
  /** Explicit data points (points / scatter / coordinate graph types) */
  points?: GraphPointDef[];
  /** Free-text annotations */
  annotations?: GraphAnnotation[];
  /**
   * Desired graph area width in layout pixels.
   * Defaults to DEFAULT_GRAPH_AREA_WIDTH if omitted.
   */
  widthHint?: number;
  /**
   * Desired graph area height in layout pixels.
   * Defaults to DEFAULT_GRAPH_AREA_HEIGHT if omitted.
   */
  heightHint?: number;
}

// ─── Internal geometry types ─────────────────────────────────────────────────

/**
 * Linear coordinate transform: graph-space ↔ canvas-pixel-space.
 * Y-axis is inverted (canvas Y increases downward; graph Y increases upward).
 */
export interface CoordTransform {
  /** Map graph x → canvas pixel x */
  toCanvasX(gx: number): number;
  /** Map graph y → canvas pixel y (Y-inverted) */
  toCanvasY(gy: number): number;
  /** Map canvas pixel x → graph x */
  toGraphX(px: number): number;
  /** Map canvas pixel y → graph y */
  toGraphY(py: number): number;
  /** Canvas left edge of the graph area */
  canvasLeft: number;
  /** Canvas top edge of the graph area */
  canvasTop: number;
  /** Canvas pixel width of the graph area */
  canvasWidth: number;
  /** Canvas pixel height of the graph area */
  canvasHeight: number;
}

/** Spec for generating evenly spaced axis ticks */
export interface TickSpec {
  /** The computed tick interval */
  step: number;
  /** All tick values within [min, max] at this step */
  ticks: number[];
}

/**
 * A sampled point from a function evaluation.
 * gy / cy are null when the function is undefined or out of visible range.
 */
export interface SamplePoint {
  /** Graph-space x coordinate */
  gx: number;
  /** Graph-space y coordinate, or null for NaN / discontinuity */
  gy: number | null;
  /** Canvas-space x coordinate */
  cx: number;
  /** Canvas-space y coordinate, or null when gy is null */
  cy: number | null;
}

/** A continuous run of canvas-space points (after discontinuity segmentation) */
export interface PolylineSegment {
  points: Array<{ cx: number; cy: number }>;
}

// ─── Layout box ──────────────────────────────────────────────────────────────

/**
 * The computed rendering contract for a graph block.
 *
 * Analogous to MathLayoutBox in src/lib/math/types.ts but top-left anchored
 * (not baseline anchored) since graphs are rectangular, not typographic.
 *
 * layout.ts quantizes this to lineUnits for atomic pagination.
 * renderer.ts calls draw() to paint the graph onto the canvas.
 */
export interface GraphLayoutBox {
  /** Total canvas width of the rendered graph, including all margins */
  width: number;
  /** Total canvas height: title + graph area + axis labels + padding */
  height: number;
  /**
   * Integer number of ruling-lattice lines consumed.
   * = Math.max(1, Math.ceil(height / rulingSpacing))
   */
  lineUnits: number;
  /**
   * The inner graph area within the total box.
   * Used by the renderer to set up CoordTransform.
   */
  graphArea: {
    left: number;   // offset from originX
    top: number;    // offset from topY
    width: number;
    height: number;
  };
  /**
   * Draw this graph block onto the canvas.
   *
   * @param ctx    2D canvas context
   * @param originX  Canvas X of the content-left margin (coordinates.contentLeft)
   * @param topY     Canvas Y of the first allocated ruling line (getBaseline(coords, lineIndex))
   * @param settings Active handwriting settings (font, pen width, ink, etc.)
   * @param random   Seeded PRNG (deterministic jitter — call makeRng(hashString(definition.id)))
   * @param ink      Resolved ink hex colour (inkHex(settings))
   */
  draw(
    ctx: CanvasRenderingContext2D,
    originX: number,
    topY: number,
    settings: HandwritingSettings,
    random: () => number,
    ink: string,
  ): void;
  /** The original definition — kept for editing and serialization */
  definition: GraphDefinition;
}

// ─── Error type ───────────────────────────────────────────────────────────────

/** Thrown by compileExpression() when the expression string is syntactically invalid */
export class GraphParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphParseError";
  }
}
