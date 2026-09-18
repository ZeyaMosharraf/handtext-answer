# M2-P1 — Handwritten Graph Support — Architecture

> *GSD Phase Architecture Document*  
> *Phase:* M2-P1  
> *Date:* September 2026  
> *Status:* Architecture Proposed — Pending PLAN.md

---

## 1. Architecture Overview

The Handwritten Graph Support feature introduces a new isolated subsystem `src/lib/graph/`
that integrates into the existing HandText pipeline at the same integration points as the
Math subsystem: at `layout.ts` (for bounding-box/lineUnits) and at `renderer.ts` (for draw dispatch).

```
                    ┌─────────────────────────────────────┐
                    │       Existing HandText Pipeline     │
                    │                                      │
  HTML editor ──→  parse.ts  ──→  layout.ts  ──→  renderer.ts  ──→  Canvas
                    │              │                │
                    │     [NEW]    │      [NEW]     │      [NEW]
                    │  graph-block │  FlowGraphBlock│  drawGraphBlock()
                    │  token extr. │  lineUnits     │  calls graph/renderer.ts
                    └─────────────────────────────────────┘
                                  ↕
                         src/lib/graph/          ← NEW SUBSYSTEM
                           types.ts
                           parser.ts
                           geometry.ts
                           layout.ts
                           renderer.ts
                           handwriting.ts
                           index.ts
```

---

## 2. Subsystem File Structure

```
src/lib/graph/
├── types.ts          ← GraphDefinition, GraphType, coordinate types, GraphLayoutBox
├── parser.ts         ← Function expression tokenizer + recursive descent parser + evaluator
├── geometry.ts       ← Coordinate transforms, tick generation, sampling, discontinuity detection
├── layout.ts         ← Compute GraphLayoutBox dimensions, lineUnits
├── renderer.ts       ← Draw graph onto Canvas2D using pen.ts primitives
├── handwriting.ts    ← Graph-specific pen helpers (arrowheads, tick marks, point markers, grid)
└── index.ts          ← Public API: { parseGraphDefinition, layoutGraph, drawGraph }
```

### File Responsibility Summary

| File | Responsibility |
|---|---|
| `types.ts` | All TypeScript types. Zero logic. |
| `parser.ts` | Tokenize + parse + evaluate function expression strings like `"x^2"` |
| `geometry.ts` | Coordinate space transforms; auto-tick step; sampling; discontinuity segmentation |
| `layout.ts` | Compute the total bounding box (width, height) and `lineUnits` for a `GraphDefinition` |
| `renderer.ts` | Orchestrate a complete graph draw: axes, grid, curves, points, labels, title |
| `handwriting.ts` | Low-level graph-specific pen helpers built on `pen.ts` |
| `index.ts` | Re-exports the three public functions consumed by `layout.ts` and `renderer.ts` in `handwriting/` |

---

## 3. Type Definitions (`types.ts`)

```typescript
// src/lib/graph/types.ts

import type { HandwritingSettings } from "../handwriting/types";

// ─── Input definition ────────────────────────────────────────────────────────

export type GraphType = "coordinate" | "function" | "points" | "scatter";

export interface GraphFunctionDef {
  expression: string;        // e.g. "x^2", "sin(x)", "2*x+1"
  label?: string;            // e.g. "y = x²" — rendered as plain text near curve end
  color?: string;            // optional ink override (hex)
}

export interface GraphPointDef {
  x: number;
  y: number;
  label?: string;            // e.g. "(2,4)" — rendered near point
  connect: boolean;          // draw line from previous point to this one
}

export interface GraphAnnotation {
  x: number;
  y: number;
  text: string;
}

export interface GraphCoordinateSpace {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xStep?: number;            // axis tick interval (auto-computed if omitted)
  yStep?: number;
  showGrid: boolean;
  showAxisLabels: boolean;
  originVisible: boolean;
}

export interface GraphDefinition {
  id: string;                           // stable uuid
  type: GraphType;
  title?: string;
  xLabel?: string;                      // e.g. "x"
  yLabel?: string;                      // e.g. "y"
  space: GraphCoordinateSpace;
  functions?: GraphFunctionDef[];
  points?: GraphPointDef[];
  annotations?: GraphAnnotation[];
  widthHint?: number;                   // desired graph area width in layout px
  heightHint?: number;                  // desired graph area height in layout px
}

// ─── Internal geometry types ─────────────────────────────────────────────────

export interface CoordTransform {
  toCanvasX(gx: number): number;
  toCanvasY(gy: number): number;
  toGraphX(px: number): number;
  toGraphY(py: number): number;
  canvasLeft: number;
  canvasTop: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface TickSpec {
  step: number;
  ticks: number[];            // the tick values to draw (in graph space)
}

export interface SamplePoint {
  gx: number;                 // graph x
  gy: number | null;          // graph y (null = discontinuity)
  cx: number;                 // canvas x
  cy: number | null;          // canvas y
}

export interface PolylineSegment {
  points: Array<{ cx: number; cy: number }>;
}

// ─── Layout box ──────────────────────────────────────────────────────────────

export interface GraphLayoutBox {
  /** Total canvas width of the rendered graph (including margins) */
  width: number;
  /** Total canvas height of the rendered graph (title + area + labels + padding) */
  height: number;
  /** Number of ruling-lattice lines consumed by this graph (= ceil(height / rulingSpacing)) */
  lineUnits: number;
  /** The actual graph area bounds within the total box (for coordinate transform setup) */
  graphArea: { left: number; top: number; width: number; height: number };
  /**
   * Draw this graph at (originX, topY).
   * originX is the content left margin.
   * topY is the canvas Y of the first allocated ruling line (getBaseline(coords, lineIndex)).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    originX: number,
    topY: number,
    settings: HandwritingSettings,
    random: () => number,
    ink: string,
  ): void;
  /** The definition — kept for editing/serialization */
  definition: GraphDefinition;
}
```

---

## 4. Parser (`parser.ts`)

```
src/lib/graph/parser.ts

Exports:
  compileExpression(expr: string): CompiledExpression
  evaluateAt(compiled: CompiledExpression, x: number): number

Internal:
  tokenize(expr: string): Token[]
  parseExpr(tokens, pos): { node: ExprNode, pos: number }
  parseTerm / parseUnary / parsePower / parsePrimary
  evaluate(node: ExprNode, x: number): number
```

**Supported syntax:**
- Numbers: `3`, `3.14`, `.5`
- Variable: `x`
- Constants: `pi`, `e`
- Operators: `+`, `-`, `*`, `/`, `^` (right-associative)
- Functions: `sin`, `cos`, `tan`, `sqrt`, `abs`, `log`, `ln`, `exp`
- Grouping: `(expr)`

**Error handling:**
- `compileExpression` throws a `GraphParseError` (typed subclass of `Error`) on invalid syntax
- The modal catches and displays the error inline
- Invalid expressions produce no samples (empty graph area)

---

## 5. Geometry (`geometry.ts`)

```
src/lib/graph/geometry.ts

Exports:
  makeCoordTransform(space, graphAreaLeft, graphAreaTop, graphAreaWidth, graphAreaHeight): CoordTransform
  computeTickSpec(min, max, stepHint): TickSpec
  sampleFunction(compiled, space, transform, sampleCount): SamplePoint[]
  segmentizeSamples(samples): PolylineSegment[]
  clipToRange(value, min, max): number
  autoStep(range, targetTicks): number
```

**`autoStep` algorithm:**

```typescript
function autoStep(range: number, targetTicks = 5): number {
  const rawStep = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceFactor: number;
  if (normalized < 1.5) niceFactor = 1;
  else if (normalized < 3.5) niceFactor = 2;
  else if (normalized < 7.5) niceFactor = 5;
  else niceFactor = 10;
  return niceFactor * magnitude;
}
```

This produces human-friendly tick intervals like 0.5, 1, 2, 5, 10, 20, 50, etc.

---

## 6. Layout (`layout.ts`)

```
src/lib/graph/layout.ts

Exports:
  layoutGraph(definition: GraphDefinition, rulingSpacing: number): GraphLayoutBox
```

**Layout algorithm:**

```
CONSTANTS:
  GRAPH_PADDING_TOP    = 10   px
  GRAPH_PADDING_BOTTOM = 20   px
  GRAPH_PADDING_LEFT   = 40   px (y-tick labels)
  GRAPH_PADDING_RIGHT  = 20   px
  TITLE_HEIGHT         = (title ? rulingSpacing * 1.2 : 0)
  X_LABEL_HEIGHT       = (xLabel ? 28 : 0)
  Y_LABEL_WIDTH        = (yLabel ? 28 : 0)

DEFAULTS:
  graphAreaWidth  = definition.widthHint  ?? 700
  graphAreaHeight = definition.heightHint ?? 420

TOTAL:
  totalWidth  = Y_LABEL_WIDTH + GRAPH_PADDING_LEFT + graphAreaWidth + GRAPH_PADDING_RIGHT
  totalHeight = GRAPH_PADDING_TOP + TITLE_HEIGHT + graphAreaHeight + X_LABEL_HEIGHT + GRAPH_PADDING_BOTTOM
  lineUnits   = ceil(totalHeight / rulingSpacing)

GRAPH AREA (within the box):
  left   = Y_LABEL_WIDTH + GRAPH_PADDING_LEFT
  top    = GRAPH_PADDING_TOP + TITLE_HEIGHT
  width  = graphAreaWidth
  height = graphAreaHeight
```

The `draw()` function closure captures all layout constants and calls `renderer.ts`.

---

## 7. Renderer (`renderer.ts`)

```
src/lib/graph/renderer.ts

Exports:
  drawGraph(
    ctx: CanvasRenderingContext2D,
    definition: GraphDefinition,
    box: GraphLayoutBox,
    originX: number,
    topY: number,
    settings: HandwritingSettings,
    random: () => number,
    ink: string
  ): void
```

**Draw order:**

```
1. drawTitle(ctx, definition.title, ...)          ← writeText
2. drawGrid(ctx, transform, ticks, random, ink)   ← handwriting.ts: inkLine at low alpha
3. drawAxes(ctx, transform, random, ink, settings)← handwriting.ts: inkLine + arrowheads
4. drawTickMarks(ctx, ticks, transform, random)   ← handwriting.ts: inkLine short segments
5. drawTickLabels(ctx, ticks, transform, settings)← writeText for each tick number
6. drawAxisLabels(ctx, xLabel, yLabel, ...)       ← writeText (y-label rotated)
7. For each function:
     samples = sampleFunction(compiled, space, transform, 300)
     segments = segmentizeSamples(samples)
     For each segment:
       For each consecutive pair:
         inkLine(ctx, p1.cx, p1.cy, p2.cx, p2.cy, random, ink, 1.5)
     If function.label:
       writeText label near curve endpoint
8. For each point:
     drawPointMarker(ctx, cx, cy, random, ink)    ← handwriting.ts
     If connect and prev point:
       inkLine(ctx, prev.cx, prev.cy, cx, cy, random, ink, 1.5)
     If point.label:
       writeText label near point
9. For each annotation:
     writeText(ctx, annotation.text, ...)
```

---

## 8. Handwriting Helpers (`handwriting.ts`)

```
src/lib/graph/handwriting.ts

Exports:
  drawAxis(ctx, from, to, random, ink, penWidth, settings): void
  drawArrowhead(ctx, tipX, tipY, directionAngle, random, ink): void
  drawTickMark(ctx, cx, cy, isHorizontalAxis, length, random, ink): void
  drawGridLine(ctx, x1, y1, x2, y2, random, ink): void
  drawPointMarker(ctx, cx, cy, style, random, ink): void  // style: "cross" | "dot" | "circle"
```

**These are wrappers over `pen.ts` `inkLine` with graph-specific defaults.**

Example:

```typescript
export function drawGridLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  random: () => number,
  ink: string,
): void {
  ctx.save();
  ctx.globalAlpha = 0.18;   // very light grid
  inkLine(ctx, x1, y1, x2, y2, random, ink, 0.6);
  ctx.restore();
}
```

---

## 9. Public API (`index.ts`)

```typescript
// src/lib/graph/index.ts

export { parseGraphDefinition, serializeGraphDefinition } from "./types";
export { layoutGraph } from "./layout";
export { drawGraph } from "./renderer";
export type { GraphDefinition, GraphLayoutBox, GraphType } from "./types";
```

---

## 10. Pipeline Integration Changes

### 10.1 `parse.ts` — Graph Block Token Extraction

**Pattern:** Mirrors the math block token extraction (lines 356–365 in parse.ts).

New code added to `parseHtmlContent()`:

```typescript
// Pre-extract graph blocks
let graphCounter = 0;
const graphBlocksMap = new Map<string, string>();    // token → JSON definition
const tokenizedHtml2 = tokenizedHtml.replace(
  /<div[^>]*class="[^"]*graph-block[^"]*"[^>]*data-graph-definition="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
  (_, defJson) => {
    const token = `__GRAPH_BLOCK_TOKEN_${graphCounter++}__`;
    graphBlocksMap.set(token, unescapeHtml(defJson));
    return `<p data-graph-token="${token}"></p>`;
  }
);
```

And in the block processing loop:

```typescript
const graphTokenMatch = attrs.match(/data-graph-token="([^"]*)"/i);
if (graphTokenMatch && graphBlocksMap.has(graphTokenMatch[1]!)) {
  const defJson = graphBlocksMap.get(graphTokenMatch[1]!)!;
  try {
    const def = JSON.parse(defJson) as GraphDefinition;
    blocks.push({ kind: "graph", text: defJson, graph: { definition: def } });
  } catch { /* malformed JSON — skip */ }
  continue;
}
```

**BlockKind addition:**

```typescript
// parse.ts
export type BlockKind =
  | "heading" | "subheading" | "bullet" | "numbered"
  | "paragraph" | "quote" | "divider" | "table" | "blank"
  | "math"
  | "graph";    ← NEW
```

**Block type extension:**

```typescript
export interface Block {
  kind: BlockKind;
  text: string;
  segs: Seg[];
  math?: { latex: string; display: "block" | "inline" };
  graph?: { definition: GraphDefinition };    ← NEW
  // ... existing fields
}
```

---

### 10.2 `layout.ts` — FlowGraphBlock and Pagination

**New flow item type:**

```typescript
// layout.ts
interface FlowGraphBlock {
  type: "graphBlock";
  definition: GraphDefinition;
  lineUnits: number;
  gapLines: number;
}

// LayoutPlacement union extended:
export interface LayoutGraphBlock {
  type: "graphBlock";
  lineIndex: number;
  lineUnits: number;
  definition: GraphDefinition;
}

export type LayoutPlacement = LayoutLine | LayoutTableRow | LayoutMathBlock | LayoutGraphBlock;
```

**Flow item construction (analogous to `mathFlowBlock`):**

```typescript
function graphFlowBlock(block: Block, settings: HandwritingSettings): FlowGraphBlock[] {
  const def = block.graph?.definition;
  if (!def) return [];
  const rulingSpacing = settings.fontSize * settings.lineSpacing;
  const box = layoutGraph(def, rulingSpacing);
  return [{ type: "graphBlock", definition: def, lineUnits: box.lineUnits, gapLines: 1 }];
}
```

**Paginator handling (analogous to mathBlock):**

```typescript
} else if (item.type === "graphBlock") {
  placements.push({ type: "graphBlock", lineIndex, lineUnits: item.lineUnits, definition: item.definition });
}
```

---

### 10.3 `renderer.ts` — drawGraphBlock Dispatch

**New function:**

```typescript
function drawGraphBlock(
  ctx: CanvasRenderingContext2D,
  placement: Extract<LayoutPage["placements"][number], { type: "graphBlock" }>,
  settings: HandwritingSettings,
  coordinates: PageCoordinateSystem,
  random: () => number,
  ink: string,
): void {
  const rulingSpacing = coordinates.rulingSpacing;
  const box = layoutGraph(placement.definition, rulingSpacing);
  const topY = getBaseline(coordinates, placement.lineIndex);
  const originX = coordinates.contentLeft;
  box.draw(ctx, originX, topY, settings, random, ink);
}
```

**Dispatch in the page render loop:**

```typescript
// In renderPage():
if (placement.type === "graphBlock") {
  drawGraphBlock(ctx, placement, settings, coordinates, random, ink);
}
```

---

## 11. Editor Components

### 11.1 `EditorToolbar.tsx`

Add a "Graph" button to the toolbar, analogous to the existing "Math" button.

```tsx
<Button onClick={() => setGraphModalOpen(true)} variant="outline" size="sm">
  Graph
</Button>
```

### 11.2 `GraphInsertModal.tsx` (NEW)

**Location:** `src/components/editor/GraphInsertModal.tsx`

**Props:**

```typescript
interface GraphInsertModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (definition: GraphDefinition) => void;
  initialDefinition?: GraphDefinition;   // for future edit UX
}
```

**UI sections:**

1. **Graph type selector:** Radio/Tab — Coordinate | Function | Points | Scatter
2. **Function input:** Text field for expression (shown when type = "function")
   - Error display for parse failures
3. **X range:** Min and Max number inputs
4. **Y range:** Min and Max number inputs  
5. **Options:** Grid toggle, axis labels toggle, tick labels toggle
6. **Title:** Optional text field
7. **X Label / Y Label:** Optional text fields
8. **Points editor:** Add/remove rows of (x, y, label, connect) for point graphs
9. **Live technical preview:** A 300×200 digital canvas preview (NOT handwritten)
   - Refreshes on any parameter change
   - Labeled "Preview (digital — final output will be handwritten)"
10. **"Insert Graph" button**

### 11.3 `RichContentEditor.tsx`

**Insert handler:**

```typescript
function insertGraphBlock(definition: GraphDefinition): void {
  const defJson = htmlEscapeAttr(JSON.stringify(definition));
  const html = `<div class="graph-block" contenteditable="false" data-graph-definition="${defJson}">
    <span class="graph-placeholder">📊 Graph: ${definition.title || definition.type}</span>
  </div>`;
  // Restore saved caret position (same pattern as math insertion)
  restoreCaret();
  document.execCommand("insertHTML", false, html);
}
```

---

## 12. Document Model

### DOM Representation

```html
<!-- In the contenteditable editor: -->
<div
  class="graph-block"
  contenteditable="false"
  data-graph-definition="{&quot;id&quot;:&quot;g_abc123&quot;,&quot;type&quot;:&quot;function&quot;,...}"
>
  <span class="graph-placeholder">📊 Graph: Quadratic function</span>
</div>
```

The `graph-placeholder` span is purely decorative — it gives the editor block a visible
height so the cursor positioning works correctly. The authoritative data is always
`data-graph-definition`.

### Coexistence with other block types

```
[paragraph]   "The quadratic function y = x² is shown below:"
[graph-block] data-graph-definition="..."
[paragraph]   "As shown, the vertex is at the origin."
[math-block]  data-latex="\frac{dy}{dx} = 2x"
[paragraph]   "The derivative confirms a minimum at x = 0."
```

All block types coexist cleanly in the pagination system — each is an atomic flow item
placed in document order on the ruled-line lattice.

---

## 13. Data Flow Summary

```
User configures graph in GraphInsertModal
  ↓
GraphDefinition object created
  ↓ JSON.stringify + HTML attr escape
data-graph-definition attribute in DOM
  ↓ contenteditable innerHTML → IndexedDB (autosave)
  ↓ explicit Ctrl+S → Supabase cloud
  ↓ restore: load innerHTML from IndexedDB
parse.ts: parseHtmlContent()
  → graph block token extraction
  → Block { kind: "graph", graph: { definition: GraphDefinition } }
  ↓
layout.ts: graphFlowBlock()
  → src/lib/graph/layout.ts: layoutGraph()
  → FlowGraphBlock { lineUnits: N }
  → paginator: LayoutGraphBlock { lineIndex: M, lineUnits: N }
  ↓
renderer.ts: drawGraphBlock()
  → src/lib/graph/layout.ts: layoutGraph() [again, same as math pattern]
  → GraphLayoutBox.draw(ctx, originX, topY, settings, random, ink)
  → src/lib/graph/renderer.ts: drawGraph()
  → src/lib/graph/handwriting.ts: drawAxis, drawGrid, etc.
  → src/lib/handwriting/pen.ts: inkLine, writeText
  → Canvas pixels
```

---

## 14. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Function evaluator bugs (wrong precedence, missing functions) | Medium | Medium | Extensive unit tests on parser; test suite covers all operators and built-in functions |
| Discontinuity lines appearing in tan/1/x graphs | High | High | NaN/overflow check before each inkLine; test with known-discontinuous functions |
| Graph height calculation off → pagination miscounts lineUnits | Medium | High | Off-by-one tests; verify against known rulingSpacing values |
| `data-graph-definition` JSON corruption through copy-paste | Low | Medium | Validate JSON.parse in parse.ts; skip malformed definitions gracefully |
| Performance regression with many graphs in one document | Low | Low | Each graph is ~15ms; 10 graphs = 150ms add-on to existing 300ms pipeline |
| Y-axis rotation label rendering misalignment | Medium | Low | Canvas `ctx.save/rotate/restore` for Y label; test at multiple graph heights |
| Graph visually too large/small for page | Medium | Medium | Default dimensions chosen to fit standard A4 content width; test at multiple paper sizes |

---

## 15. ADR Outline (to be formalized after implementation)

**ADR-009: Handwritten Graph Support Architecture**

- **Status:** Proposed
- **Decision:** Implement graph rendering as an isolated `src/lib/graph/` subsystem following the same integration pattern as `src/lib/math/`.
- **Key choices:**
  1. `GraphDefinition` JSON schema as the storage format (not canvas screenshot)
  2. Custom lightweight expression parser (no npm dependency)
  3. `pen.ts` `inkLine` for all geometric strokes
  4. `writeText` for all text labels
  5. `lineUnits = ceil(height / rulingSpacing)` for atomic pagination
  6. Atomic page-break policy (no graph splitting)
- **Consequences:** Zero new runtime dependencies; full handwritten aesthetics; editability preserved; clean module boundary.
