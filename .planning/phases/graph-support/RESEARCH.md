# M2-P1 — Handwritten Graph Support — Technical Research

> *GSD Phase Research — comprehensive technical investigation*  
> *Phase:* M2-P1  
> *Date:* September 2026  
> *Status:* Research Complete — ready for architecture finalization

---

## Executive Summary

This document answers all 20 research questions for the Handwritten Graph Support feature.
It is grounded in the existing HandText codebase (parse → layout → renderer → pen pipeline)
and the established Math Notation Architecture (ADR-008).

**Key findings:**
1. A lightweight graph subsystem (~6 TypeScript files, ~15–20 KB) is sufficient.
2. No third-party graphing library is needed or justified.
3. The Math Notation Architecture's patterns (atomic lineUnits, MathLayoutBox-style draw interface)
   apply directly to graphs with minimal adaptation.
4. `pen.ts` can be reused safely via a thin `GraphPen` adapter layer.
5. The primary implementation risk is the function evaluator's discontinuity handling.

---

## Research Question Answers

---

### Q1 — Best Graph AST / Data Model?

**Finding:** A `GraphDefinition` struct (NOT an AST in the traditional sense) is the right model.
Graphs are not syntactic trees — they are declarative geometric specifications.

A graph definition describes:
- What kind of graph it is
- The coordinate space parameters
- The data it renders (functions, point series, annotations)
- The visual options (grid, labels, title)

**Recommended schema:**

```typescript
// src/lib/graph/types.ts

export type GraphType = "coordinate" | "function" | "points" | "scatter";

export interface GraphFunctionDef {
  expression: string;   // e.g. "x^2", "sin(x)", "2*x+1"
  label?: string;       // e.g. "y = x²"
  color?: string;       // optional override (hex)
}

export interface GraphPointDef {
  x: number;
  y: number;
  label?: string;       // e.g. "(2,4)"
  connect?: boolean;    // draw line to next point
}

export interface GraphAnnotation {
  x: number;
  y: number;
  text: string;
}

export interface GraphCoordinateSpace {
  xMin: number;         // e.g. -5
  xMax: number;         // e.g.  5
  yMin: number;         // e.g. -2
  yMax: number;         // e.g. 10
  xStep?: number;       // tick interval (auto if omitted)
  yStep?: number;
  showGrid: boolean;
  showAxisLabels: boolean;
  originVisible: boolean;
}

export interface GraphDefinition {
  id: string;                          // stable uuid for identification
  type: GraphType;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  space: GraphCoordinateSpace;
  functions?: GraphFunctionDef[];
  points?: GraphPointDef[];
  annotations?: GraphAnnotation[];
  widthPx?: number;                    // desired canvas width in layout px (default: full content width)
  heightPx?: number;                   // desired canvas height in layout px
}
```

**Rationale for NOT using a parse tree:** The input to the graph subsystem is a structured definition,
not a string expression. Only the *function expression strings* (e.g. `"x^2"`) require a mini-parser.
The overall graph definition is already structured (produced by the modal UI or typed by the user).

**Serialization:** `JSON.stringify(GraphDefinition)` → stored in `data-graph-definition` attribute.

---

### Q2 — Function Expression Parser Requirements?

**Finding:** A recursive descent parser over a simple grammar is sufficient.

**Grammar (EBNF):**

```
expr      = term (('+' | '-') term)*
term      = unary (('*' | '/') unary)*
unary     = ('-' | '+') unary | power
power     = primary ('^' power)?          // right-associative
primary   = number | 'x' | 'pi' | 'e' | funcCall | '(' expr ')'
funcCall  = name '(' expr ')'
name      = 'sin' | 'cos' | 'tan' | 'sqrt' | 'abs' | 'log' | 'ln' | 'exp'
number    = digit+ ('.' digit+)?
```

**Tokenizer output type:**

```typescript
type Token =
  | { kind: "num"; value: number }
  | { kind: "var" }                     // x
  | { kind: "const"; name: "pi" | "e" }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { kind: "fn"; name: string }
  | { kind: "lparen" | "rparen" }
  | { kind: "eof" };
```

**AST node type:**

```typescript
type ExprNode =
  | { kind: "num"; value: number }
  | { kind: "var" }
  | { kind: "binop"; op: "+" | "-" | "*" | "/" | "^"; left: ExprNode; right: ExprNode }
  | { kind: "unary"; op: "+" | "-"; arg: ExprNode }
  | { kind: "fn"; name: string; arg: ExprNode }
  | { kind: "const"; name: "pi" | "e" };
```

**Evaluation:**

```typescript
function evaluate(node: ExprNode, x: number): number {
  switch (node.kind) {
    case "num":    return node.value;
    case "var":    return x;
    case "const":  return node.name === "pi" ? Math.PI : Math.E;
    case "unary":  return node.op === "-" ? -evaluate(node.arg, x) : evaluate(node.arg, x);
    case "binop": {
      const l = evaluate(node.left, x);
      const r = evaluate(node.right, x);
      switch (node.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return r === 0 ? NaN : l / r;
        case "^": return Math.pow(l, r);
      }
    }
    case "fn":
      switch (node.name) {
        case "sin":  return Math.sin(evaluate(node.arg, x));
        case "cos":  return Math.cos(evaluate(node.arg, x));
        case "tan":  return Math.tan(evaluate(node.arg, x));
        case "sqrt": return Math.sqrt(evaluate(node.arg, x));
        case "abs":  return Math.abs(evaluate(node.arg, x));
        case "log":  return Math.log10(evaluate(node.arg, x));
        case "ln":   return Math.log(evaluate(node.arg, x));
        case "exp":  return Math.exp(evaluate(node.arg, x));
        default:     return NaN;
      }
  }
}
```

**Estimated implementation size:** ~120 lines of TypeScript (tokenizer + parser + evaluator).

---

### Q3 — Function Sampling Strategy?

**Finding:** Uniform sampling with configurable density is the baseline; adaptive sampling is optional.

**Recommended baseline approach:**

1. Sample `N = 300` evenly spaced x-values from `[xMin, xMax]`.
2. For each x, evaluate `y = f(x)`.
3. Mark samples where `y` is `NaN`, `Infinity`, or `|y| > yMax * 10` as "discontinuous breaks".
4. Build polyline segments — break on discontinuities.
5. Convert each (x, y) pair to canvas pixel coordinates using the coordinate transform.
6. Render each polyline segment as a series of `inkLine` calls (producing natural pen jitter).

**Why 300 samples?** At typical graph widths (~700–1000 canvas pixels), 300 samples gives ~2.3–3.3
samples per pixel — smooth without being wasteful. For a simple handwritten curve, the visual
noise from `inkLine` jitter naturally smooths minor point-to-point kinks.

**Adaptive sampling (optional, Phase 2):** For functions with high curvature (e.g. sin(10x)),
insert additional samples in regions where the angle between consecutive segments exceeds a
threshold. This prevents under-sampling of rapid oscillations.

---

### Q4 — Discontinuity Handling?

**Finding:** A NaN-break strategy is the correct approach. No attempt to "bridge" discontinuities.

**Strategy:**

```typescript
function segmentizeSamples(samples: Array<{ x: number; y: number | null }>): Array<Array<{ x: number; y: number }>> {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  for (const s of samples) {
    if (s.y === null || !isFinite(s.y)) {
      if (current.length >= 2) segments.push(current);
      current = [];
    } else {
      current.push({ x: s.x, y: s.y });
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}
```

**Clipping:** Values where `y < yMin` or `y > yMax` should be clipped to the graph boundary
rather than discarded — this produces correct axis-crossing behavior for steep functions.

**tan(x) / 1/x example:** These functions have vertical asymptotes where the value explodes
toward ±∞ across a tiny x-interval. The NaN/overflow check prevents a line being drawn
from `+1e15` to `-1e15`, which would destroy the graph appearance.

---

### Q5 — Coordinate Transform Design?

**Finding:** A simple linear transform from graph-space to canvas-space is sufficient.

**Transform:**

```typescript
interface CoordTransform {
  // Map graph coordinates to canvas pixel coordinates
  toCanvasX(gx: number): number;
  toCanvasY(gy: number): number;
  // Map canvas pixel coordinates back to graph coordinates (for hit-testing, annotations)
  toGraphX(px: number): number;
  toGraphY(py: number): number;
}

function makeTransform(space: GraphCoordinateSpace, canvasLeft: number, canvasTop: number, canvasWidth: number, canvasHeight: number): CoordTransform {
  const scaleX = canvasWidth  / (space.xMax - space.xMin);
  const scaleY = canvasHeight / (space.yMax - space.yMin);
  return {
    toCanvasX: (gx) => canvasLeft  + (gx - space.xMin) * scaleX,
    toCanvasY: (gy) => canvasTop   + (space.yMax - gy) * scaleY,    // Y is flipped
    toGraphX:  (px) => space.xMin  + (px - canvasLeft)  / scaleX,
    toGraphY:  (py) => space.yMax  - (py - canvasTop)   / scaleY,
  };
}
```

**Y-axis flip:** Canvas Y increases downward; graph Y increases upward. The transform inverts Y
with `(space.yMax - gy) * scaleY`.

**Origin position:** The origin `(0, 0)` maps to canvas coordinates:
```
originX_canvas = canvasLeft + (0 - space.xMin) * scaleX
originY_canvas = canvasTop  + (space.yMax - 0) * scaleY
```

This may be outside the visible graph area if `xMin > 0` or `yMin > 0` — the renderer
must clip axis drawing to the visible region.

---

### Q6 — Axis and Grid Generation?

**Finding:** Standard academic graph conventions apply. The graph subsystem generates all axis
geometry deterministically; `pen.ts` `inkLine` strokes add the handwritten appearance.

**X-Axis:**

```
From (xMin_canvas, originY_canvas) to (xMax_canvas, originY_canvas)
Arrowhead at right end
```

**Y-Axis:**

```
From (originX_canvas, yMax_canvas) to (originX_canvas, yMin_canvas)
Arrowhead at top end
```

**Tick marks:**

- Auto tick step: `autoStep(range) = 10^floor(log10(range/5))`
- Ticks drawn as short `inkLine` segments perpendicular to the axis
- Tick labels (numbers) drawn with `writeText` at each tick position

**Grid lines (if `showGrid`):**

- Drawn as very light, thin `inkLine` strokes (low alpha: `0.15–0.25`)
- Drawn along every x-tick and y-tick position
- Color: same as ink color but alpha-reduced, to suggest pencil graph paper

**Arrowheads:**

- Small filled triangle or two `inkLine` strokes at ~20° from axis direction
- Produces a natural handwritten arrow appearance

**Label positioning:**

- X-axis label: centered below the x-axis, at `yMin_canvas + labelHeight + padding`
- Y-axis label: rotated 90°, to the left of the y-axis, centered vertically
- Tick labels: 2–4 digit numbers, below x-axis ticks, to the left of y-axis ticks

---

### Q7 — Graph Bounding-Box Calculation?

**Finding:** The graph bounding box must be calculated before layout — exactly as `MathLayoutBox`
calculates `ascent` and `descent` before `layout.ts` quantizes to `lineUnits`.

**GraphLayoutBox dimensions:**

```typescript
interface GraphLayoutBox {
  width: number;       // total canvas width of the graph (including axis labels, padding)
  height: number;      // total canvas height (title + graph area + axis labels + padding)
  lineUnits: number;   // ceil(height / rulingSpacing) — for pagination
  draw: (ctx, originX, originY, settings, random, ink) => void;
  definition: GraphDefinition;   // kept for serialization/editing
}
```

**Height composition:**

```
totalHeight = titleHeight + graphAreaHeight + xLabelHeight + bottomPadding
           where:
             titleHeight     = (title ? 1 * rulingSpacing : 0)
             graphAreaHeight = heightPx (user-specified, default: 400–500px)
             xLabelHeight    = (xLabel ? 30 : 0)
             bottomPadding   = 20
```

**Width composition:**

```
totalWidth = yLabelWidth + yAxisMargin + graphAreaWidth + rightPadding
           where:
             yLabelWidth    = (yLabel ? 30 : 0)
             yAxisMargin    = 40   // space for y-axis tick labels
             graphAreaWidth = widthPx (default: contentRight - contentLeft)
             rightPadding   = 20
```

---

### Q8 — GraphLayoutBox Design?

**Finding:** Mirror the `MathLayoutBox` pattern but adapted for top-left anchor instead of baseline.

Unlike math (which is anchored to a text baseline), graphs sit in a rectangular region anchored at
the top-left of the content area. The analogy:

| Math | Graph |
|---|---|
| `MathLayoutBox.ascent` | `GraphLayoutBox.topOffset` |
| `MathLayoutBox.descent` | `GraphLayoutBox.height - topOffset` |
| `MathLayoutBox.draw(ctx, x, baselineY, ...)` | `GraphLayoutBox.draw(ctx, x, topY, ...)` |
| `computeLineUnits(box, rulingSpacing)` | `ceil(totalHeight / rulingSpacing)` |

**Layout integration pattern:**

```typescript
// layout.ts (analogous to FlowMathBlock)
interface FlowGraphBlock {
  type: "graphBlock";
  definition: GraphDefinition;
  lineUnits: number;
  gapLines: number;
}

// layout.ts (analogous to LayoutMathBlock)
export interface LayoutGraphBlock {
  type: "graphBlock";
  lineIndex: number;
  lineUnits: number;
  definition: GraphDefinition;
}
```

The paginator handles `graphBlock` exactly as `mathBlock`: atomic, never split, full lineUnits
consumed.

---

### Q9 — Handwritten Stroke Rendering?

**Finding:** The graph renderer builds on `pen.ts` primitives exclusively. The key functions:

| pen.ts function | Graph use |
|---|---|
| `inkLine(ctx, x1, y1, x2, y2, random, color, width)` | Axes, tick marks, grid lines, curve segments |
| `writeText(ctx, text, settings, x, baselineY, random, pen)` | Tick labels, axis labels, title |
| `writeSegments(...)` | Annotations, point labels |
| `makeRng(seed)` | Seeded PRNG for deterministic jitter within a render pass |
| `hashString(str)` | Seed from graph ID for stable jitter across renders |

**Curve rendering strategy:**

```
For each continuous polyline segment (after discontinuity segmentation):
  For each consecutive pair of sample points (p_i, p_{i+1}):
    inkLine(ctx, p_i.cx, p_i.cy, p_{i+1}.cx, p_{i+1}.cy, random, ink, strokeWidth)
```

Each `inkLine` call introduces subtle wavering (±1.6 px), producing a naturally irregular
handwritten curve appearance while remaining geometrically accurate at the sampled points.

**Point markers:**

```
drawPointMarker(ctx, cx, cy, random, ink):
  // Draw a small cross (+) or dot at the point
  inkLine(ctx, cx-4, cy, cx+4, cy, random, ink, 1.5)    // horizontal bar
  inkLine(ctx, cx, cy-4, cx, cy+4, random, ink, 1.5)    // vertical bar
  // Or draw a small circle approximated by 8 short inkLine segments
```

**Axis arrowheads:**

```
drawArrowhead(ctx, tipX, tipY, angle, random, ink):
  // Two short strokes angled ±20° from the tip
  const len = 12;
  inkLine(ctx, tipX, tipY, tipX - cos(angle+20°)*len, tipY - sin(angle+20°)*len, random, ink, 1.5)
  inkLine(ctx, tipX, tipY, tipX - cos(angle-20°)*len, tipY - sin(angle-20°)*len, random, ink, 1.5)
```

---

### Q10 — How to Reuse pen.ts Safely?

**Finding:** `pen.ts` has a clean, pure function API. The graph subsystem reuses it directly
with three constraints:

1. **No Seg[] dependency for geometric strokes.** `inkLine` only takes raw coordinates. The graph
   renderer calls `inkLine` directly for axes, ticks, grid, and curves without producing `Seg[]`.

2. **`writeText` / `writeSegments` for labels.** Axis tick numbers, title, axis labels — all use
   the standard `writeText` function. This ensures labels match the document's handwriting style.

3. **Import isolation.** `src/lib/graph/` imports from `../handwriting/pen` but NEVER from
   `../handwriting/layout`, `../handwriting/parse`, or `../math`. Any required types (like
   `HandwritingSettings`) are imported from `../handwriting/types`.

**The safe import pattern:**

```typescript
// src/lib/graph/renderer.ts
import { inkLine, writeText, makeRng, hashString, type PenOptions } from "../handwriting/pen";
import type { HandwritingSettings } from "../handwriting/types";
import type { GraphDefinition, GraphLayoutBox } from "./types";
```

**`pen.ts` remains unchanged.** The graph subsystem is purely a consumer of its API.

---

### Q11 — Math ↔ Graph Boundary?

**Finding:** The boundary is clean and enforced by module imports.

```
Math subsystem (src/lib/math/):
  parser.ts → types.ts → layout.ts → glyphs.ts

Graph subsystem (src/lib/graph/):
  parser.ts → types.ts → geometry.ts → layout.ts → renderer.ts → handwriting.ts

Shared:
  src/lib/handwriting/pen.ts  ← ONLY shared primitive layer
  src/lib/handwriting/types.ts  ← HandwritingSettings type
```

**What the graph subsystem does NOT touch:**
- `parseMath()` / `layoutMath()` — no dependency on math internals
- `MathLayoutBox` — no reuse of the math layout box type
- `glyphs.ts` — no Greek glyph paths (graph labels are plain text)
- Math block DOM attributes (`data-latex`) — separate from `data-graph-definition`

**What layout.ts / renderer.ts bridge:**
- `layout.ts` calls into `src/lib/graph/` to compute `lineUnits` for graph blocks (parallel to how it calls `layoutMath` for math blocks)
- `renderer.ts` calls into `src/lib/graph/` to draw graph blocks at their computed `lineIndex` position

**Why not share MathLayoutBox?** The box model is different: Math uses baseline/ascent/descent;
Graph uses a top-left rectangular bounding box. Sharing the interface would force awkward
baseline accounting for a fundamentally rectangular object.

---

### Q12 — Graph ↔ Page-Grid Boundary?

**Finding:** The page grid (ruled lines, grid paper) and the graph's internal coordinate grid
are completely independent.

**Page-level ruled lines:**
- Drawn by `renderer.ts` `paintPaper()` as background decoration
- Spacing = `settings.fontSize * settings.lineSpacing`
- Used by `layout.ts` as the lattice for text baseline positioning

**Graph internal grid:**
- Drawn by `src/lib/graph/renderer.ts` inside the graph area
- Spacing = `stepX * scaleX` pixels (derived from the graph's coordinate space)
- Drawn with `inkLine` at reduced opacity (0.15–0.25)

**Integration point:** The only connection is:
- `layout.ts` allocates `lineUnits = ceil(graphHeight / rulingSpacing)` lines for the graph block
- `renderer.ts` places the graph's top-left at the baseline of `lineIndex` (the first allocated line)

The graph's internal content is completely self-contained within its allocated rectangular area.

---

### Q13 — Graph Pagination?

**Finding:** Identical policy to table rows and math blocks — atomic pagination.

**Implementation in `layout.ts` paginator:**

```typescript
// In the flow item processing loop:
if (item.type === "graphBlock") {
  const units = item.lineUnits;
  // If doesn't fit in remaining capacity, spill to next page
  if (currentLineIndex + units > capacity) {
    // Flush current page, start new page
    pages.push({ pageNumber, coordinates, placements });
    pageNumber++;
    placements = [];
    currentLineIndex = 0;
  }
  placements.push({ type: "graphBlock", lineIndex: currentLineIndex, lineUnits: units, definition: item.definition });
  currentLineIndex += units;
}
```

**Padding:** A graph block should request 1 extra `gapLine` above it (same as math blocks) to
ensure it does not sit flush against the preceding text line.

**Minimum page size check:** If a graph's `lineUnits` exceeds the page capacity entirely, a warning
should be issued and the graph rendered on its own dedicated page (overflowing if necessary).
This is an edge case — normal academic graphs fit within 10–20 lines.

---

### Q14 — Graph Persistence?

**Finding:** The `data-graph-definition` attribute value survives all persistence layers without
special handling, provided it is properly HTML-entity-escaped.

**Persistence path:**

```
GraphDefinition object
  → JSON.stringify()
  → HTML-entity-escape (for attribute safety)
  → stored in contenteditable DOM as data-graph-definition="..."
  → contenteditable's innerHTML
  → IndexedDB autosave (1000ms debounce)
  → explicit cloud save (Ctrl+S → Supabase PATCH)
  → restore: innerHTML → parse.ts → graph-block token → GraphDefinition JSON.parse()
```

**parse.ts changes required:**

Analogous to the math block token extraction pattern:

```typescript
// In parseHtmlContent(), pre-extract graph blocks before the blockRegex loop:
const tokenizedHtml = html.replace(
  /<div[^>]*class="[^"]*graph-block[^"]*"[^>]*data-graph-definition="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
  (_, defJson) => {
    const token = `__GRAPH_BLOCK_TOKEN_${graphCounter++}__`;
    graphBlocksMap.set(token, defJson);
    return `<p data-graph-token="${token}"></p>`;
  }
);
```

**Round-trip safety:** JSON is plain ASCII-safe when stringified (no HTML-special characters
in keys or values, assuming expression strings are validated to exclude `<`, `>`, `"`, `&`).
The JSON value for `data-graph-definition` should be HTML-attribute-escaped before insertion.

---

### Q15 — Graph Editing?

**M2-P1 scope:** Insert-only. Click-to-edit is deferred.

**Insert flow:**
1. User clicks "Graph" in toolbar
2. `GraphInsertModal` opens with default parameters
3. User configures graph
4. User clicks "Insert Graph"
5. Modal saves caret position before opening
6. On insert: inject `<div class="graph-block" contenteditable="false" data-graph-definition="...">` at saved caret
7. Graph appears as a placeholder block in the editor
8. Render pipeline picks up the graph block and renders it on next canvas refresh

**Edit flow (deferred to M2-P2):**
- Click on graph block → re-open `GraphInsertModal` pre-populated with existing definition
- User changes parameters → "Update Graph"
- DOM node's `data-graph-definition` attribute updated in place

---

### Q16 — Multiple Graphs?

**Finding:** Multiple graphs are supported automatically by the existing architecture.

- Each graph block is an independent DOM node with its own `data-graph-definition`
- `parse.ts` extracts all graph block tokens in document order
- `layout.ts` creates one `FlowGraphBlock` per graph block, in document order
- The paginator places them as independent atomic items
- `renderer.ts` renders each at its allocated `lineIndex` position

No special "graph array" management is needed. The document model naturally handles N graphs.

---

### Q17 — Performance?

**Analysis:**

| Operation | Cost | Notes |
|---|---|---|
| Parse `GraphDefinition` from JSON | ~0.1ms | JSON.parse on a ~500 byte object |
| Function tokenize + parse | ~0.5ms | ~120 line recursive descent parser |
| Sample 300 points | ~2ms | 300 `evaluate()` calls + 300 transform calls |
| Discontinuity segmentation | <0.1ms | Single O(N) pass |
| Draw 300 `inkLine` calls | ~8–15ms | Each inkLine is 1 canvas path with jitter |
| Write axis labels (10–20 chars) | ~2ms | Same as normal text rendering |

**Per-graph cost: ~12–20ms** on a typical 2020-era laptop.

**Multiple graphs:** For 5 graphs, total rendering cost: ~60–100ms. This is within the acceptable
range for the HandText render pipeline (current pipeline runs in 200–500ms for typical documents).

**No server dependency.** All computation is client-side. No async I/O in the render path.

**Memory:** Each `GraphDefinition` is ~200–500 bytes in JSON. A document with 10 graphs uses
<5 KB of definition storage. No memory pressure.

---

### Q18 — Testing Strategy?

**Unit tests (Vitest):**

| Test | Scope |
|---|---|
| `parser.test.ts` | Tokenizer + parser: valid expressions, precedence, functions, error cases |
| `geometry.test.ts` | Coordinate transforms, tick generation, auto-step calculation |
| `sampling.test.ts` | Function sampling, discontinuity detection, segment extraction |
| `layout.test.ts` | `lineUnits` calculation, bounding box dimensions |
| `serialization.test.ts` | JSON round-trip for `GraphDefinition` |

**Integration tests:**

- `layout.ts` correctly produces `LayoutGraphBlock` placements with correct `lineIndex` and `lineUnits`
- `parse.ts` correctly extracts `GraphDefinition` from `data-graph-definition` attribute HTML
- Multiple graphs in one document: each placed at correct lineIndex across pages

**Canvas rendering tests (visual):**

- Snapshot tests comparing rendered canvas output against reference bitmaps
- Browser UAT script (see Q19) for end-to-end behavioral verification

---

### Q19 — Browser UAT Strategy?

**Approach:** Extend the existing browser UAT pattern established in `tests/test-math-insertion-lifecycle.ts`.

**Proposed test cases:**

1. **Graph insertion lifecycle:** Open editor → click Graph → configure coordinate graph → Insert → verify DOM contains `data-graph-definition` attribute → verify canvas updated
2. **Function graph rendering:** Insert `y = x^2` with x range `[-5,5]` → verify rendered canvas is non-empty
3. **Point data graph:** Insert points `(1,2),(2,4),(3,9)` → verify points appear in rendered output
4. **Graph persistence:** Insert graph → reload page → verify graph restored from IndexedDB
5. **Multiple graphs:** Insert 3 different graphs → verify all appear in document order on canvas
6. **Pagination:** Insert graph that overflows page → verify graph appears atomically on page 2
7. **Math coexistence:** Insert math block before and after graph → verify no overlap or corruption

---

### Q20 — Which Dependencies, If Any, Are Justified?

**Evaluation:**

| Library | Size | Purpose | Decision |
|---|---|---|---|
| Chart.js | ~200 KB min | SVG/canvas charts | **REJECTED** — digital output incompatible with handwritten requirement |
| Plotly.js | ~3.5 MB | Interactive charts | **REJECTED** — massive bundle, digital SVG output |
| D3.js | ~280 KB | Data visualization | **REJECTED** — SVG-based, digital output |
| function-plot | ~50 KB + D3 | Function graphing | **REJECTED** — depends on D3, SVG output |
| math-expression-evaluator | ~15 KB | Expression evaluation | **CONSIDERED** — lightweight but adds a dependency for a ~120-line task |
| mathjs | ~600 KB | Math operations | **REJECTED** — massively oversized for simple function evaluation |

**Decision: No new runtime dependencies.**

The custom recursive-descent parser + evaluator is ~120 lines. Importing an npm package to save
120 lines adds a dependency-management burden, potential security surface, and bundle weight that
are all unjustified for this scope.

**Build-time tooling:** No changes to the existing Vite + Bun build setup required.

---

## Summary of Research Outcomes

| Question | Key Finding |
|---|---|
| Q1 — Data model | `GraphDefinition` struct (not AST); JSON serialization |
| Q2 — Parser | Custom ~120-line recursive descent; supports sin/cos/tan/sqrt/abs/log/ln/exp |
| Q3 — Sampling | 300 uniform samples; adaptive optional in Phase 2 |
| Q4 — Discontinuities | NaN-break strategy; clipping to visible range |
| Q5 — Coordinate transform | Linear map with Y-flip; `toCanvasX/Y` + `toGraphX/Y` |
| Q6 — Axes & grid | Auto tick step; `inkLine` strokes; light alpha for grid |
| Q7 — Bounding box | `title + graphArea + xLabel + padding`; measured before layout |
| Q8 — GraphLayoutBox | Top-left anchor; `lineUnits = ceil(height / rulingSpacing)` |
| Q9 — Stroke rendering | `inkLine` polyline segments; `writeText` for labels |
| Q10 — pen.ts reuse | Direct import; no new API changes to pen.ts required |
| Q11 — Math↔Graph boundary | Separate subsystems; only `pen.ts` and `types.ts` shared |
| Q12 — Graph↔page boundary | Completely isolated; page allocates lineUnits only |
| Q13 — Pagination | Atomic; same as math blocks and table rows |
| Q14 — Persistence | data-graph-definition attr; JSON round-trip; parse.ts token extraction |
| Q15 — Editing | M2-P1: insert only; M2-P2: click-to-edit |
| Q16 — Multiple graphs | Automatic; no special handling needed |
| Q17 — Performance | ~12–20ms/graph; 5 graphs < 100ms; no server dependency |
| Q18 — Unit tests | Vitest: parser, geometry, sampling, layout, serialization |
| Q19 — Browser UAT | Extend test-math-insertion-lifecycle pattern |
| Q20 — Dependencies | **Zero new runtime dependencies** |
