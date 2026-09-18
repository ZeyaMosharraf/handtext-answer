# M2-P1 — Handwritten Graph Support — Implementation Plan

> **Phased Implementation Plan for Handwritten Graph Rendering**  
> *Status:* Approved — Ready for Execution  
> *Phase:* M2-P1  
> *Architecture Reference:* [ARCHITECTURE.md](./ARCHITECTURE.md)  
> *Research Reference:* [RESEARCH.md](./RESEARCH.md)  
> *Context Reference:* [CONTEXT.md](./CONTEXT.md)  
> *ADR Reference:* [ADR-009](../../docs/decisions/ADR-009-handwritten-graph-architecture.md)  
> *UAT Reference:* [UAT.md](./UAT.md)  
> *Last Updated:* September 2026

---

## Scope

Implement a complete handwritten graph support system for HandText, allowing students to
insert academic/scientific graphs (coordinate axes, function plots, point data, scatter plots)
that render as authentic handwritten content on ruled A4 pages.

### In Scope

- `src/lib/graph/` subsystem: types, parser, geometry, layout, renderer, handwriting helpers
- Extension of `parse.ts` — graph block DOM token extraction
- Extension of `layout.ts` — `FlowGraphBlock` + atomic pagination
- Extension of `renderer.ts` — `drawGraphBlock()` dispatch
- `GraphInsertModal.tsx` — new editor UI component
- `EditorToolbar.tsx` — Graph button
- `RichContentEditor.tsx` — graph insert handler
- Comprehensive automated test suite
- Browser E2E verification (14 UAT cases)

### Out of Scope (explicitly deferred)

- Click-on-graph-to-edit UX (M2-P2)
- Math-labeled axes using `parseMath` (future)
- Polar / parametric / 3D graphs (future)
- Multi-function overlay on one graph (future)
- Question Panel (deferred independently)
- `pen.ts` modifications (must remain unchanged)
- Supabase / auth / database changes

---

## Architectural Constraints

> These constraints must be enforced throughout all implementation phases.

1. **`pen.ts` is immutable.** It must remain a pure handwriting/stroke primitive engine with no knowledge of graphs, coordinates, or `GraphDefinition` types.

2. **`src/lib/graph/` owns all graph concerns.** No graph parsing, geometry, or rendering logic in `parse.ts`, `layout.ts`, `renderer.ts`, or `RichContentEditor.tsx` directly.

3. **`layout.ts` treats graphs as atomic flow items.** A `FlowGraphBlock` has a pre-computed `lineUnits` and is never split across pages.

4. **`renderer.ts` is a thin bridge.** It calls `layoutGraph()` from `src/lib/graph/` and dispatches `GraphLayoutBox.draw()`. All actual canvas operations go through `pen.ts` primitives.

5. **Final output is handwritten Canvas rendering.** No SVG, no Chart.js, no canvas screenshot embedding.

6. **Randomness affects only visual appearance.** Coordinate geometry, sample points, axis positions, and tick values must be deterministic across renders.

7. **Zero new runtime dependencies.** The graph subsystem is entirely self-contained TypeScript.

---

## Phase 1: Graph Core — Types, Parser, and Geometry

**Goal:** Build the foundational graph data model, function expression evaluator, and geometric
coordinate system. This is the computation layer — no canvas rendering yet.

**Tracer slice:** A correct `compileExpression("x^2")` that evaluates to `4.0` at `x = 2.0`, with
a `makeCoordTransform` that maps `(2, 4)` in graph space to the correct canvas pixel.

### Files Created

- `src/lib/graph/types.ts` — All TypeScript types (`GraphDefinition`, `GraphLayoutBox`, `CoordTransform`, `SamplePoint`, etc.)
- `src/lib/graph/parser.ts` — Function expression tokenizer, recursive-descent parser, evaluator
- `src/lib/graph/geometry.ts` — Coordinate transforms, auto-tick generation, function sampling, discontinuity segmentation

### Deliverables

**`types.ts`:**
- [ ] `GraphType` union: `"coordinate" | "function" | "points" | "scatter"`
- [ ] `GraphFunctionDef`: `{ expression, label?, color? }`
- [ ] `GraphPointDef`: `{ x, y, label?, connect }`
- [ ] `GraphAnnotation`: `{ x, y, text }`
- [ ] `GraphCoordinateSpace`: `{ xMin, xMax, yMin, yMax, xStep?, yStep?, showGrid, showAxisLabels, originVisible }`
- [ ] `GraphDefinition`: full structured definition with all above fields
- [ ] `CoordTransform`: `{ toCanvasX, toCanvasY, toGraphX, toGraphY, canvasLeft, canvasTop, canvasWidth, canvasHeight }`
- [ ] `SamplePoint`: `{ gx, gy: number|null, cx, cy: number|null }`
- [ ] `PolylineSegment`: `{ points: Array<{cx, cy}> }`
- [ ] `GraphLayoutBox` interface: `{ width, height, lineUnits, graphArea, draw(), definition }`
- [ ] `GraphParseError` class extending `Error`

**`parser.ts`:**
- [ ] `Token` discriminated union (num, var, const, op, fn, lparen, rparen, eof)
- [ ] `tokenize(expr: string): Token[]` — handles all operators, functions, constants
- [ ] `ExprNode` AST union (num, var, const, binop, unary, fn)
- [ ] `parseExpr(tokens, pos)` — recursive descent, correct precedence for `+/-`, `*/÷`, unary, `^` (right-assoc)
- [ ] `parseTerm()`, `parseUnary()`, `parsePower()`, `parsePrimary()` helpers
- [ ] `evaluate(node: ExprNode, x: number): number` — handles NaN/Infinity naturally
- [ ] `compileExpression(expr: string): { evaluate(x: number): number }` — public API, throws `GraphParseError` on invalid syntax
- [ ] Supported functions: `sin`, `cos`, `tan`, `sqrt`, `abs`, `log` (log₁₀), `ln`, `exp`
- [ ] Supported constants: `pi`, `e`

**`geometry.ts`:**
- [ ] `makeCoordTransform(space, canvasLeft, canvasTop, canvasWidth, canvasHeight): CoordTransform`
  - Y-axis inverted: `toCanvasY(gy) = canvasTop + (yMax - gy) * scaleY`
- [ ] `autoStep(range: number, targetTicks?: number): number`
  - Produces nice intervals: 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100...
- [ ] `computeTickSpec(min, max, stepHint?): TickSpec`
  - Returns `{ step, ticks: number[] }` — all tick values within [min, max]
- [ ] `sampleFunction(compiled, space, transform, sampleCount?): SamplePoint[]`
  - Default `sampleCount = 300`
  - Clamps `gy` that exceeds range ±50% beyond `yMax`/`yMin` to `null` (discontinuity)
  - Sets `gy = null` when `evaluate()` returns `NaN` or `Infinity`
- [ ] `segmentizeSamples(samples: SamplePoint[]): PolylineSegment[]`
  - Splits on null `gy` entries; minimum segment length = 2 points
- [ ] `clipToRange(value, min, max): number`

### Test File

`tests/test-graph-core.ts`

### Required Passing Tests

```
PASS: parse "3.14"         → evaluates to 3.14 at any x
PASS: parse "x"            → evaluates to 2.0 at x=2
PASS: parse "x^2"          → evaluates to 4.0 at x=2
PASS: parse "x^2"          → evaluates to 9.0 at x=3
PASS: parse "2*x+1"        → evaluates to 5.0 at x=2
PASS: parse "sin(pi)"      → evaluates to ≈0 (within 1e-10)
PASS: parse "cos(0)"       → evaluates to 1.0
PASS: parse "sqrt(4)"      → evaluates to 2.0
PASS: parse "abs(-5)"      → evaluates to 5.0
PASS: parse "ln(e)"        → evaluates to 1.0
PASS: parse "log(100)"     → evaluates to 2.0
PASS: parse "exp(0)"       → evaluates to 1.0
PASS: parse "1/x" at x=0   → returns NaN (not throw)
PASS: parse "tan(pi/2)"    → returns NaN or Infinity (not throw)
PASS: parse "sqrt(-1)"     → returns NaN (not throw)
PASS: parse invalid "^^2"  → throws GraphParseError
PASS: parse "x^(2+1)"      → evaluates to 8.0 at x=2
PASS: parse "-x^2"         → evaluates to -4.0 at x=2 (unary minus lower than ^)
PASS: parse "-(x^2)"       → evaluates to -4.0 at x=2

PASS: makeCoordTransform: toCanvasX(xMin) = canvasLeft
PASS: makeCoordTransform: toCanvasX(xMax) = canvasLeft + canvasWidth
PASS: makeCoordTransform: toCanvasY(yMax) = canvasTop
PASS: makeCoordTransform: toCanvasY(yMin) = canvasTop + canvasHeight
PASS: makeCoordTransform: round-trip x → canvas → graph ≈ x (within 0.001)
PASS: makeCoordTransform: round-trip y → canvas → graph ≈ y (within 0.001)

PASS: autoStep(10)  → 2 (5 ticks in [0,10])
PASS: autoStep(100) → 20
PASS: autoStep(1)   → 0.2
PASS: autoStep(0.5) → 0.1

PASS: computeTickSpec(-5, 5) → step=2, ticks includes -4,-2,0,2,4
PASS: computeTickSpec(-5, 5) → no ticks outside [-5, 5]

PASS: sampleFunction x^2 → 300 samples, no null at x=2
PASS: sampleFunction 1/x → samples have null at x≈0
PASS: sampleFunction tan(x) → at least one null near π/2
PASS: segmentizeSamples → segments split at null gy
PASS: segmentizeSamples → segments have min length 2
PASS: segmentizeSamples → no null points inside returned segments
```

### Verification

```bash
npx tsx tests/test-graph-core.ts
npx tsc --noEmit
```

---

## Phase 2: Graph Layout Engine

**Goal:** Compute the total bounding box (`GraphLayoutBox`) for a `GraphDefinition`, quantize
it to integer `lineUnits` based on `rulingSpacing`, and produce a `draw()` closure ready for
`renderer.ts` to call.

### Files Created

- `src/lib/graph/layout.ts` — `layoutGraph(definition, rulingSpacing): GraphLayoutBox`

### Deliverables

**`layout.ts`:**
- [ ] `GRAPH_PADDING_TOP = 10` (px)
- [ ] `GRAPH_PADDING_BOTTOM = 20` (px)
- [ ] `GRAPH_PADDING_LEFT = 40` (px — space for y-axis tick labels)
- [ ] `GRAPH_PADDING_RIGHT = 20` (px)
- [ ] `DEFAULT_GRAPH_AREA_WIDTH = 700` (px, used when `widthHint` omitted)
- [ ] `DEFAULT_GRAPH_AREA_HEIGHT = 420` (px, used when `heightHint` omitted)
- [ ] `layoutGraph(definition, rulingSpacing): GraphLayoutBox`
  - Computes `titleHeight = definition.title ? Math.ceil(rulingSpacing * 1.2) : 0`
  - Computes `xLabelHeight = definition.xLabel ? 28 : 0`
  - Computes `yLabelWidth = definition.yLabel ? 28 : 0`
  - Computes `graphAreaWidth = definition.widthHint ?? DEFAULT_GRAPH_AREA_WIDTH`
  - Computes `graphAreaHeight = definition.heightHint ?? DEFAULT_GRAPH_AREA_HEIGHT`
  - `totalWidth = yLabelWidth + GRAPH_PADDING_LEFT + graphAreaWidth + GRAPH_PADDING_RIGHT`
  - `totalHeight = GRAPH_PADDING_TOP + titleHeight + graphAreaHeight + xLabelHeight + GRAPH_PADDING_BOTTOM`
  - `lineUnits = Math.max(1, Math.ceil(totalHeight / rulingSpacing))`
  - Returns `GraphLayoutBox` with `width, height, lineUnits, graphArea, draw, definition`
  - The `draw()` closure captures all layout constants and calls `drawGraph()` from `renderer.ts`

### Test File

`tests/test-graph-layout.ts`

### Required Passing Tests

```
PASS: layoutGraph with default dimensions → lineUnits ≥ 1
PASS: layoutGraph with title → totalHeight > without title
PASS: layoutGraph without title → totalHeight ≤ with title
PASS: layoutGraph with xLabel → totalHeight > without xLabel
PASS: layoutGraph with yLabel → totalWidth > without yLabel
PASS: lineUnits = ceil(totalHeight / rulingSpacing) exactly
PASS: lineUnits ≥ 1 even for tiny rulingSpacing
PASS: graphArea.left = yLabelWidth + GRAPH_PADDING_LEFT
PASS: graphArea.top = GRAPH_PADDING_TOP + titleHeight
PASS: graphArea.width = graphAreaWidth (default or hint)
PASS: graphArea.height = graphAreaHeight (default or hint)
PASS: widthHint=500 → graphArea.width = 500
PASS: heightHint=300 → graphArea.height = 300
```

### Verification

```bash
npx tsx tests/test-graph-layout.ts
npx tsc --noEmit
```

---

## Phase 3: Handwriting & Renderer

**Goal:** Implement the full canvas drawing pipeline for graphs. All strokes go through
`pen.ts` primitives (`inkLine`, `writeText`, `writeSegments`). Nothing is digital.

### Files Created

- `src/lib/graph/handwriting.ts` — Low-level pen helpers specific to graph elements
- `src/lib/graph/renderer.ts` — Orchestrates the complete graph draw sequence
- `src/lib/graph/index.ts` — Public API re-exports

### Deliverables

**`handwriting.ts`:**
- [ ] `drawGraphLine(ctx, x1, y1, x2, y2, random, ink, width)` — `inkLine` wrapper, no alpha override
- [ ] `drawGridLine(ctx, x1, y1, x2, y2, random, ink)` — `inkLine` at `globalAlpha = 0.18`, `width = 0.6`
- [ ] `drawAxis(ctx, x1, y1, x2, y2, random, ink, penWidth)` — `inkLine` at `width = penWidth * 1.2`
- [ ] `drawArrowhead(ctx, tipX, tipY, angleDeg, random, ink)` — Two `inkLine` strokes at ±20° from tip, length = 12px
- [ ] `drawTickMark(ctx, cx, cy, isXAxis, tickLength, random, ink)` — Short `inkLine` perpendicular to axis, length = 8px
- [ ] `drawPointMarker(ctx, cx, cy, style, random, ink)` — style `"cross"`: two `inkLine` strokes; style `"dot"`: tiny filled circle via ctx.arc + fill
- [ ] All helpers import `inkLine` from `../../handwriting/pen`, NOT from any other module

**`renderer.ts`:**
- [ ] `drawGraph(ctx, definition, box, originX, topY, settings, random, ink): void`
- [ ] Internal draw order:
  1. `drawTitle`: `writeText(ctx, title, settings, titleX, titleBaselineY, random, { size, color: ink })`
  2. If `showGrid`: `drawGridLine` calls along every x-tick and y-tick
  3. X-axis: `drawAxis(ctx, leftX, originY, rightX, originY, ...)` then `drawArrowhead` at right
  4. Y-axis: `drawAxis(ctx, originX, bottomY, originX, topY, ...)` then `drawArrowhead` at top
  5. X-tick marks + numeric labels: `drawTickMark` + `writeText` for each tick in `xTicks.ticks`
  6. Y-tick marks + numeric labels: `drawTickMark` + `writeText` for each tick in `yTicks.ticks`
  7. X-axis label (if present): `writeText` centered below x-axis
  8. Y-axis label (if present): `ctx.save(); ctx.rotate(-Math.PI/2); writeText; ctx.restore()`
  9. For each `GraphFunctionDef`:
     - `compileExpression(fn.expression)` — catch `GraphParseError`, skip silently
     - `sampleFunction(compiled, space, transform, 300)` 
     - `segmentizeSamples(samples)`
     - For each segment, for each consecutive pair: `drawGraphLine(ctx, p1.cx, p1.cy, p2.cx, p2.cy, ...)`
     - If `fn.label`: `writeText` near curve's last visible point
  10. For each `GraphPointDef`:
      - `drawPointMarker(ctx, cx, cy, "cross", random, ink)`
      - If previous point has `connect`: `drawGraphLine(ctx, prevCx, prevCy, cx, cy, ...)`
      - If `pt.label`: `writeText` near point
  11. For each `GraphAnnotation`:
      - `writeText(ctx, annotation.text, settings, cx+8, cy, random, { size, color: ink })`
- [ ] Axis origin clipping: only draw axes where they fall within the graph area bounds
- [ ] Tick label formatting: `formatTickLabel(value): string`
  - Integer values: no decimal point (`"2"`, not `"2.0"`)
  - Non-integer: up to 2 decimal places (`"0.5"`, `"3.14"`)
  - Very small/large: scientific notation with 1 decimal (`"1.0e-5"`)
- [ ] `src/lib/graph/index.ts`:
  ```typescript
  export { layoutGraph } from "./layout";
  export { drawGraph } from "./renderer";
  export type { GraphDefinition, GraphLayoutBox, GraphType } from "./types";
  ```

### Verification

```bash
npx tsc --noEmit
# Manual browser check: insert function graph, verify no digital lines
```

### Canvas Spot Checks

- [ ] Axes have natural `inkLine` wavering — not pixel-perfect straight lines
- [ ] Arrowheads look hand-drawn (two strokes at angle)
- [ ] Tick marks are short perpendicular strokes with ink variation
- [ ] Tick labels use the document's handwriting font (e.g. Kalam)
- [ ] Function curve `y = x^2` has characteristic parabola shape with pen jitter
- [ ] Grid lines are clearly lighter than axes (alpha ~0.18)
- [ ] Discontinuous functions (tan, 1/x) do NOT draw lines across asymptotes
- [ ] Point markers appear at correct coordinate positions

---

## Phase 4: Pipeline Integration

**Goal:** Wire the graph subsystem into the existing `parse.ts → layout.ts → renderer.ts`
pipeline so that graph blocks flow through the document exactly like math blocks and table rows.

### Files Modified

- `src/lib/handwriting/parse.ts` — Add `"graph"` to `BlockKind`, add graph block DOM extraction
- `src/lib/handwriting/layout.ts` — Add `FlowGraphBlock`, `LayoutGraphBlock`, integrate into `buildFlow()` and `paginate()`
- `src/lib/handwriting/renderer.ts` — Add `drawGraphBlock()`, dispatch in the render loop

### Deliverables

**`parse.ts`:**
- [ ] Add `"graph"` to `BlockKind` union:
  ```typescript
  export type BlockKind = ... | "graph";
  ```
- [ ] Add `graph?: { definition: GraphDefinition }` field to `Block` interface
- [ ] In `parseHtmlContent()`, before the `blockRegex` loop, add graph block pre-extraction:
  ```
  Replace <div class="graph-block" ... data-graph-definition="...">...</div>
  With    <p data-graph-token="__GRAPH_BLOCK_TOKEN_N__"></p>
  Accumulate in graphBlocksMap (token → JSON string)
  ```
- [ ] In the block-processing loop, detect `data-graph-token` attribute:
  - `JSON.parse(defJson)` to recover `GraphDefinition`
  - On parse error: skip silently (graceful degradation)
  - Push `Block { kind: "graph", text: defJson, graph: { definition } }`
- [ ] `KIND_SCALE` map: add `graph: 1` entry (consistent with `math: 1` and `table: 1`)

**`layout.ts`:**
- [ ] Add `FlowGraphBlock` internal type:
  ```typescript
  interface FlowGraphBlock {
    type: "graphBlock";
    definition: GraphDefinition;
    lineUnits: number;
    gapLines: number;
  }
  ```
- [ ] Add `LayoutGraphBlock` export type:
  ```typescript
  export interface LayoutGraphBlock {
    type: "graphBlock";
    lineIndex: number;
    lineUnits: number;
    definition: GraphDefinition;
  }
  ```
- [ ] Extend `LayoutPlacement` union: `| LayoutGraphBlock`
- [ ] Add `graphFlowBlock(block, settings): FlowGraphBlock[]`:
  ```
  const def = block.graph?.definition;
  if (!def) return [];
  const rulingSpacing = settings.fontSize * settings.lineSpacing;
  const box = layoutGraph(def, rulingSpacing);    ← import from src/lib/graph
  return [{ type: "graphBlock", definition: def, lineUnits: box.lineUnits, gapLines: 1 }];
  ```
- [ ] In `buildFlow()`: dispatch `block.kind === "graph"` to `graphFlowBlock(block, settings)`
- [ ] In `paginate()` flow item loop, handle `item.type === "graphBlock"`:
  - Atomic: if `currentLineIndex + units > capacity` → spill to next page
  - Place: `{ type: "graphBlock", lineIndex, lineUnits: item.lineUnits, definition: item.definition }`
  - Advance: `currentLineIndex += item.lineUnits`
- [ ] Add import: `import { layoutGraph } from "../graph";`
- [ ] Add import for `GraphDefinition` type

**`renderer.ts`:**
- [ ] Add `drawGraphBlock()` function:
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
    box.draw(ctx, coordinates.contentLeft, topY, settings, random, ink);
  }
  ```
- [ ] In the page render loop (where `mathBlock` is handled), add `graphBlock` dispatch:
  ```typescript
  if (placement.type === "graphBlock") {
    drawGraphBlock(ctx, placement, settings, coordinates, random, ink);
  }
  ```
- [ ] Add import: `import { layoutGraph } from "../graph";`

### Test File

`tests/test-graph-pipeline.ts`

### Required Passing Tests

```
PASS: parseHtmlContent with graph-block div → Block { kind: "graph", graph.definition defined }
PASS: parseHtmlContent with malformed graph JSON → silently skipped (no crash)
PASS: parseHtmlContent with no graph blocks → output identical to baseline (no regression)
PASS: graphFlowBlock → returns FlowGraphBlock with lineUnits ≥ 1
PASS: graphFlowBlock → lineUnits = ceil(totalHeight / rulingSpacing)
PASS: paginator places graph atomically (lineIndex consistent)
PASS: paginator spills graph to next page when insufficient space
PASS: paginator never splits a graph block across two pages
PASS: text before and after graph → correct lineIndex offsets
PASS: two graphs in one document → each at correct lineIndex in document order
PASS: math block before graph block → no lineIndex collision
PASS: table row before graph block → no lineIndex collision
```

### Regression Verification

```bash
npx tsx tests/test-graph-pipeline.ts
npx tsx tests/test-graph-core.ts
npx tsx tests/test-graph-layout.ts
npx tsx tests/test-table-cell-height.ts          # Must stay 100% green
npx tsx tests/test-table-operations.test.ts       # Must stay 100% green
npx tsx tests/test-restoration-idempotency.ts     # Must stay 100% green
npx tsx tests/test-math-parser.ts                 # Must stay 100% green
npx tsx tests/test-math-layout.ts                 # Must stay 100% green
npx tsx tests/test-math-pagination.ts             # Must stay 100% green
npx tsc --noEmit                                  # Zero TypeScript errors
```

---

## Phase 5: Editor UX — GraphInsertModal and Toolbar

**Goal:** Deliver the complete user-facing graph insertion experience. Users can open a modal,
configure a graph, see a digital technical preview, and insert a handwritten graph block.

### Files Created/Modified

- `src/components/editor/GraphInsertModal.tsx` — [NEW] Graph configuration modal
- `src/components/editor/EditorToolbar.tsx` — [EXTEND] Add Graph button
- `src/components/editor/RichContentEditor.tsx` — [EXTEND] Add graph insert handler

### Deliverables

**`GraphInsertModal.tsx`:**
- [ ] Props:
  ```typescript
  interface GraphInsertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (definition: GraphDefinition) => void;
    initialDefinition?: GraphDefinition;    // future: edit UX
  }
  ```
- [ ] State:
  ```typescript
  type: GraphType
  expression: string          // for function graphs
  expressionError: string | null
  xMin, xMax, yMin, yMax: number
  xLabel, yLabel, title: string
  showGrid: boolean
  showAxisLabels: boolean
  points: Array<{ x: string; y: string; label: string; connect: boolean }>
  ```
- [ ] Default values:
  - type: `"function"`, expression: `"x^2"`, xMin: `-5`, xMax: `5`, yMin: `-2`, yMax: `26`
  - xLabel: `"x"`, yLabel: `"y"`, title: `""`, showGrid: `true`, showAxisLabels: `true`
- [ ] UI sections:
  1. **Graph type tabs:** Coordinate / Function / Points / Scatter
  2. **Expression input** (function type only): text field with live parse validation
     - Red border + inline error when expression is invalid
     - Error cleared when expression becomes valid
  3. **X range / Y range:** four number inputs (xMin, xMax, yMin, yMax)
  4. **Title, X Label, Y Label:** text inputs
  5. **Grid toggle, Axis labels toggle**
  6. **Points editor** (points/scatter type): add/remove rows with x, y, label, connect checkbox
  7. **Live technical preview canvas** (300×200 digital canvas, NOT handwritten):
     - Re-renders on every state change (debounced 150ms)
     - Renders using standard `ctx.strokeStyle` / `ctx.beginPath` (digital, not pen.ts)
     - Labeled below: `"Preview (digital — final page output will be handwritten)"`
     - Shows coordinate transform, function curves, points, axes at correct positions
  8. **Insert Graph button:** disabled if `expressionError !== null`
  9. **Cancel button**
- [ ] On Insert:
  ```typescript
  const definition: GraphDefinition = {
    id: crypto.randomUUID(),
    type,
    title: title || undefined,
    xLabel: xLabel || undefined,
    yLabel: yLabel || undefined,
    space: { xMin, xMax, yMin, yMax, showGrid, showAxisLabels, originVisible: true },
    functions: type === "function" ? [{ expression, label: `y = ${expression}` }] : undefined,
    points: (type === "points" || type === "scatter")
      ? points.filter(p => p.x && p.y).map(p => ({
          x: parseFloat(p.x), y: parseFloat(p.y),
          label: p.label || undefined,
          connect: p.connect,
        }))
      : undefined,
  };
  onInsert(definition);
  onClose();
  ```
- [ ] `onMouseDown={e => e.preventDefault()}` on all interactive elements (preserve editor caret — same pattern as `MathFormulaModal`)

**`EditorToolbar.tsx`:**
- [ ] Add Graph button (after the Math button):
  ```tsx
  <Button
    id="toolbar-graph"
    onClick={onGraphClick}
    variant="outline"
    size="sm"
    title="Insert graph"
  >
    📊
  </Button>
  ```
- [ ] Pass `onGraphClick` prop through `EditorToolbarProps`

**`RichContentEditor.tsx`:**
- [ ] Add state: `graphModalOpen: boolean`
- [ ] Add ref: `savedCaretRef` (reuse existing pattern from math insertion)
- [ ] `handleGraphClick()`:
  - Save caret position to `savedCaretRef` (same as `handleMathClick`)
  - Set `graphModalOpen = true`
- [ ] `insertGraphBlock(definition: GraphDefinition)`:
  ```typescript
  const defJson = JSON.stringify(definition)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const title = definition.title || definition.type;
  const html = `<div class="graph-block" contenteditable="false" ` +
    `data-graph-definition="${defJson}">` +
    `<span class="graph-placeholder">📊 ${title}</span></div>`;
  restoreSavedCaret();
  document.execCommand("insertHTML", false, html);
  ```
- [ ] Wire `GraphInsertModal` with `isOpen={graphModalOpen}`, `onClose`, `onInsert={insertGraphBlock}`
- [ ] Pass `onGraphClick` to `EditorToolbar`

### CSS

Add to the editor stylesheet:

```css
.graph-block {
  display: block;
  min-height: 2.5em;
  padding: 8px 12px;
  background: rgba(99, 102, 241, 0.04);
  border-left: 3px solid rgba(99, 102, 241, 0.35);
  border-radius: 4px;
  margin: 6px 0;
  cursor: default;
  user-select: none;
}

.graph-placeholder {
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
  color: rgba(99, 102, 241, 0.7);
  pointer-events: none;
}
```

### Verification

```bash
npx tsc --noEmit
npm run dev
# Open browser → editor → click "Graph" button
# Verify modal opens
# Verify Insert button inserts graph-block into editor
# Verify canvas re-renders with handwritten graph
```

---

## Phase 6: End-to-End Verification

**Goal:** Execute all UAT cases, run full test suite, verify zero regressions, verify build.

### Test Files Summary

| Test file | Phase | Minimum tests |
|---|---|---|
| `tests/test-graph-core.ts` | 1 | ≥35 tests |
| `tests/test-graph-layout.ts` | 2 | ≥13 tests |
| `tests/test-graph-pipeline.ts` | 4 | ≥12 tests |

### Full Verification Sequence

```bash
# Graph-specific tests
npx tsx tests/test-graph-core.ts
npx tsx tests/test-graph-layout.ts
npx tsx tests/test-graph-pipeline.ts

# Regression: math tests (must remain 100% green)
npx tsx tests/test-math-parser.ts
npx tsx tests/test-math-layout.ts
npx tsx tests/test-math-pagination.ts

# Regression: existing tests (must remain 100% green)
npx tsx tests/test-table-cell-height.ts
npx tsx tests/test-table-operations.test.ts
npx tsx tests/test-restoration-idempotency.ts

# TypeScript
npx tsc --noEmit

# Build
npm run build
```

### Browser UAT Execution

Execute all 14 cases from [UAT.md](./UAT.md):

| ID | Scenario | Pass Criteria |
|---|---|---|
| UAT-G01 | Graph insertion lifecycle | DOM has `data-graph-definition`; canvas updates |
| UAT-G02 | y = x² function graph | Parabola shape; handwritten strokes; correct label |
| UAT-G03 | y = sin(x) | Sine wave; zero-crossings correct; no spurious lines |
| UAT-G04 | y = tan(x) discontinuity | No vertical lines at asymptotes; branches separate |
| UAT-G05 | Point data graph (connected) | Points at correct coordinates; lines between them |
| UAT-G06 | Scatter plot | Markers at correct coordinates; no connecting lines |
| UAT-G07 | IndexedDB persistence | Graph restored after tab close/reopen |
| UAT-G08 | Cloud persistence | Graph loads in fresh browser session after Ctrl+S |
| UAT-G09 | Multiple graphs | All 3 graphs in correct order; no overlap |
| UAT-G10 | Pagination atomicity | Graph starts top of page 2; not split |
| UAT-G11 | Math + Graph coexistence | Correct vertical ordering; no layout corruption |
| UAT-G12 | Visual quality | Manual inspection: axes wave, ticks jitter, font matches |
| UAT-G13 | Parse error handling | Inline error shown; no crash |
| UAT-G14 | Graph without title/labels | Renders without optional elements; no crash |

### Post-Verification

- [ ] Update [ADR-009](../../docs/decisions/ADR-009-handwritten-graph-architecture.md) status to `"Accepted — Implemented"`
- [ ] Update [docs/CHANGELOG.md](../../docs/CHANGELOG.md) with M2-P1 entry
- [ ] Commit all phase changes with message: `feat(graph): add handwritten graph support (M2-P1)`

---

## Files Summary

| File | Status | Phase |
|---|---|---|
| `src/lib/graph/types.ts` | NEW | 1 |
| `src/lib/graph/parser.ts` | NEW | 1 |
| `src/lib/graph/geometry.ts` | NEW | 1 |
| `src/lib/graph/layout.ts` | NEW | 2 |
| `src/lib/graph/handwriting.ts` | NEW | 3 |
| `src/lib/graph/renderer.ts` | NEW | 3 |
| `src/lib/graph/index.ts` | NEW | 3 |
| `src/lib/handwriting/parse.ts` | EXTEND | 4 |
| `src/lib/handwriting/layout.ts` | EXTEND | 4 |
| `src/lib/handwriting/renderer.ts` | EXTEND | 4 |
| `src/lib/handwriting/pen.ts` | **UNCHANGED** | — |
| `src/lib/math/` (all files) | **UNCHANGED** | — |
| `src/components/editor/GraphInsertModal.tsx` | NEW | 5 |
| `src/components/editor/EditorToolbar.tsx` | EXTEND | 5 |
| `src/components/editor/RichContentEditor.tsx` | EXTEND | 5 |
| `tests/test-graph-core.ts` | NEW | 1 |
| `tests/test-graph-layout.ts` | NEW | 2 |
| `tests/test-graph-pipeline.ts` | NEW | 4 |

---

## Backward Compatibility Guarantee

- All existing projects (plain text, tables, headings, bullets, math blocks) must render **exactly as before**.
- `pen.ts` is not modified.
- `BlockKind` is extended with `"graph"` (additive — existing block types unchanged).
- `LayoutPlacement` is extended with `LayoutGraphBlock` (additive — existing types unchanged).
- Parser fallback: any content not matching `class="graph-block" data-graph-definition="..."` is unaffected.
- All 6 existing test files must remain 100% green after every phase.

---

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Discontinuity lines (tan, 1/x, sqrt asymptotes) | **HIGH** | NaN-break strategy in `segmentizeSamples`; explicit test cases in Phase 1 |
| `lineUnits` off-by-one → pagination miscount | **HIGH** | Off-by-one tests in Phase 2; verify against known `rulingSpacing` values |
| JSON attribute corruption via copy-paste in contenteditable | Medium | `JSON.parse` in try/catch in `parse.ts`; graceful skip |
| Y-axis label rotation clipping outside graph area | Medium | Canvas `save/rotate/restore`; test at tall and short graph heights |
| Expression parser precedence bug (`-x^2` vs `(-x)^2`) | Medium | Explicit precedence test cases in Phase 1 test suite |
| Graph visually oversized for A4 content width | Low | Default `widthHint = 700`, tested at A4/A5/Letter; user-configurable |
| Performance regression (many graphs + math in one doc) | Low | Each graph ~15–20ms; 10 graphs ≤200ms overhead |
