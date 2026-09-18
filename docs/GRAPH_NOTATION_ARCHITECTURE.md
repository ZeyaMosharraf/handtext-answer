# HandText — Handwritten Graph Support Architecture

> **Technical Architecture Analysis & Design for Handwritten Graph Rendering**  
> *Target Audience:* Core Engineers, Graph Subsystem Contributors, AI Development Workflows  
> *Last Updated:* September 2026  
> *Document Status:* Architecture Proposed — Pending Implementation (Phase M2-P1)

---

## 1. Goal & Non-Goals

### Goal

Allow students to insert academic/scientific graphs into their handwritten A4 assignment answers.
The final A4 canvas output must render graphs **as handwritten content** — pen strokes, natural
variation, and handwriting personality — not as digital charts, SVG overlays, or canvas screenshots.

### Non-Goals

- Do NOT stamp digital Chart.js/Plotly/D3 SVGs or screenshots onto handwritten paper.
- Do NOT make `pen.ts` responsible for graph mathematics or coordinate system concerns.
- Do NOT implement graph logic inside `renderer.ts`, `parse.ts`, or `RichContentEditor.tsx` directly.
- Do NOT merge `src/lib/graph/` into `src/lib/math/` — they are separate subsystems.
- Do NOT build the Question Panel or synchronized left-right workspace (deferred separately).

---

## 2. Critical Architectural Invariants

These must be preserved during implementation:

1. **`pen.ts` remains a pure handwriting/glyph/ink simulation engine.** It is unaware of graph semantics, coordinate systems, or mathematical structures.

2. **The Graph Subsystem (`src/lib/graph/`) owns all graph concerns.** Function expression parsing, geometry computation, coordinate transforms, curve sampling, and stroke layout are confined to this module.

3. **`layout.ts` treats graphs as atomic 2D rectangular bounding boxes.** It quantizes their height to integer `lineUnits` for pagination, exactly as table rows and math blocks are treated.

4. **`renderer.ts` bridges the graph layout box to canvas rendering.** It calls into `src/lib/graph/` to obtain the `GraphLayoutBox`, then delegates stroke rendering to `pen.ts` primitives.

5. **The final canvas output must look handwritten.** No SVG pasting, no digital-library rasterization, no canvas PNG screenshots.

6. **Randomness affects only appearance, never geometry.** Mathematical coordinates, curve samples, tick positions, and axis scales are deterministic. Only visual stroke jitter is random.

---

## 3. Graph Input Model

### Storage Format: `GraphDefinition` JSON

```typescript
// Stored as: data-graph-definition="{ ... JSON ... }" on DOM node

interface GraphDefinition {
  id: string;                  // stable uuid (for editor selection identification)
  type: "coordinate" | "function" | "points" | "scatter";
  title?: string;              // rendered as handwritten text above graph
  xLabel?: string;             // e.g. "x"
  yLabel?: string;             // e.g. "y"
  space: {
    xMin: number;  xMax: number;
    yMin: number;  yMax: number;
    xStep?: number;            // auto-computed if omitted
    yStep?: number;
    showGrid: boolean;
    showAxisLabels: boolean;
    originVisible: boolean;
  };
  functions?: Array<{
    expression: string;        // e.g. "x^2", "sin(x)"
    label?: string;
    color?: string;
  }>;
  points?: Array<{
    x: number;  y: number;
    label?: string;
    connect: boolean;
  }>;
  annotations?: Array<{ x: number; y: number; text: string }>;
  widthHint?: number;          // layout px, default 700
  heightHint?: number;         // layout px, default 420
}
```

**Why JSON, not LaTeX?** Graphs are not syntactic expressions — they are geometric configurations.
JSON directly models the multi-field structure (coordinate space, multiple functions, point arrays)
without requiring a bespoke serialization language.

**Why not canvas screenshot?** Screenshots lose all editability. A `GraphDefinition` can be
deserialized and displayed in `GraphInsertModal` for post-insertion editing.

---

## 4. Subsystem Architecture

### File Structure

```
src/lib/graph/
├── types.ts          ← All TypeScript types — zero logic
├── parser.ts         ← Function expression tokenizer, parser, and evaluator
├── geometry.ts       ← Coordinate transforms, tick generation, sampling, discontinuity handling
├── layout.ts         ← Compute GraphLayoutBox dimensions and lineUnits
├── renderer.ts       ← Orchestrate full graph draw call
├── handwriting.ts    ← Graph pen helpers: axes, arrowheads, ticks, grid, point markers
└── index.ts          ← Public API re-exports
```

### Module Dependencies

```
index.ts
  ├── layout.ts
  │     └── types.ts
  └── renderer.ts
        ├── geometry.ts
        │     ├── parser.ts
        │     └── types.ts
        ├── handwriting.ts
        │     └── ../handwriting/pen.ts  ← ONLY external dependency
        └── types.ts

All modules import HandwritingSettings from ../handwriting/types.ts
NO module imports from ../handwriting/layout.ts, ../handwriting/parse.ts, or ../math/
```

---

## 5. Function Expression Parser

### Grammar

```
expr      = term (('+' | '-') term)*
term      = unary (('*' | '/') unary)*
unary     = ('-' | '+') unary | power
power     = primary ('^' power)?          // right-associative
primary   = number | 'x' | 'pi' | 'e' | funcCall | '(' expr ')'
funcCall  = name '(' expr ')'
name      = 'sin' | 'cos' | 'tan' | 'sqrt' | 'abs' | 'log' | 'ln' | 'exp'
```

### Operator Precedence

| Level | Operators | Associativity |
|---|---|---|
| 1 (highest) | `^` | Right |
| 2 | Unary `-` `+` | Right |
| 3 | `*` `/` | Left |
| 4 (lowest) | `+` `-` | Left |

### Supported Functions

| Input | Maps to |
|---|---|
| `sin(x)` | `Math.sin(x)` |
| `cos(x)` | `Math.cos(x)` |
| `tan(x)` | `Math.tan(x)` |
| `sqrt(x)` | `Math.sqrt(x)` |
| `abs(x)` | `Math.abs(x)` |
| `log(x)` | `Math.log10(x)` |
| `ln(x)` | `Math.log(x)` |
| `exp(x)` | `Math.exp(x)` |
| `pi` | `Math.PI` |
| `e` | `Math.E` |

---

## 6. Geometry: Coordinate Transform

### Linear Transform

```
scaleX = canvasWidth  / (xMax - xMin)
scaleY = canvasHeight / (yMax - yMin)

toCanvasX(gx) = canvasLeft + (gx - xMin) * scaleX
toCanvasY(gy) = canvasTop  + (yMax - gy) * scaleY    // Y is inverted
```

### Tick Generation

```typescript
function autoStep(range: number, targetTicks = 5): number {
  // Produces human-friendly intervals: 1, 2, 5, 10, 0.1, 0.5, etc.
}
```

### Discontinuity Handling

```
Samples with y = NaN or |y| > large threshold → treated as breaks
Breaks split the polyline into separate segments
Each segment is rendered as a continuous inkLine chain
No line is drawn across a break (prevents asymptote artifacts)
```

---

## 7. Layout Integration

### GraphLayoutBox Interface

```typescript
interface GraphLayoutBox {
  width: number;       // total px (including label margins)
  height: number;      // total px (title + area + x-label + padding)
  lineUnits: number;   // ceil(height / rulingSpacing)
  graphArea: { left: number; top: number; width: number; height: number };
  draw(ctx, originX, topY, settings, random, ink): void;
  definition: GraphDefinition;
}
```

### Flow Item Types (layout.ts additions)

```typescript
// Internal flow item
interface FlowGraphBlock {
  type: "graphBlock";
  definition: GraphDefinition;
  lineUnits: number;
  gapLines: number;      // = 1 (one blank line above graph, same as math)
}

// Externally emitted placement
export interface LayoutGraphBlock {
  type: "graphBlock";
  lineIndex: number;
  lineUnits: number;
  definition: GraphDefinition;
}
```

### Paginator Behavior

```
Graph is atomic: if (currentLineIndex + lineUnits > capacity) → push new page
Graph is placed: lineIndex = currentLineIndex
currentLineIndex += lineUnits
```

Identical to the `mathBlock` paginator logic.

---

## 8. Rendering Pipeline

### Draw Order

```
1. Title (writeText, above graph area)
2. Grid lines (inkLine at α≈0.18)
3. X-Axis (inkLine + arrowhead)
4. Y-Axis (inkLine + arrowhead)
5. X-Tick marks + labels (inkLine + writeText)
6. Y-Tick marks + labels (inkLine + writeText)
7. Axis labels: xLabel (writeText), yLabel (writeText, rotated)
8. Function curves (inkLine polylines per segment)
9. Function labels (writeText near curve endpoint)
10. Point markers (inkLine cross/dot)
11. Point-to-point connection lines (inkLine)
12. Point labels (writeText)
13. Annotations (writeText)
```

### Pen Stroke Specifications

| Element | pen.ts call | stroke width | alpha |
|---|---|---|---|
| Axis | `inkLine` | `penWidth * 1.2` | 0.9 |
| Arrowhead | `inkLine` ×2 | `penWidth` | 0.9 |
| Tick mark | `inkLine` | `penWidth * 0.8` | 0.85 |
| Grid line | `inkLine` | 0.6 | 0.18 |
| Function curve | `inkLine` per segment | 1.5 | 0.88 |
| Point marker | `inkLine` ×2 (cross) | 1.5 | 0.9 |
| Label text | `writeText` | — | ink settings |

---

## 9. Pipeline Integration: parse → layout → renderer

### parse.ts Changes

```
parseHtmlContent() pre-extracts graph-block divs:

<div class="graph-block" contenteditable="false"
     data-graph-definition="...JSON...">...</div>

→ replaced with: <p data-graph-token="__GRAPH_BLOCK_TOKEN_N__"></p>

→ later resolved to: Block { kind: "graph", graph: { definition: GraphDefinition } }
```

### layout.ts Changes

```
graphFlowBlock(block, settings) → FlowGraphBlock[]
  calls: src/lib/graph/layout.ts layoutGraph(def, rulingSpacing)
  returns: [{ type: "graphBlock", definition, lineUnits, gapLines: 1 }]

paginator handles "graphBlock" identically to "mathBlock" (atomic, no split)
LayoutGraphBlock added to LayoutPlacement union
```

### renderer.ts Changes

```
drawGraphBlock(ctx, placement, settings, coordinates, random, ink)
  calls: layoutGraph(placement.definition, rulingSpacing) → box
  topY = getBaseline(coordinates, placement.lineIndex)
  box.draw(ctx, coordinates.contentLeft, topY, settings, random, ink)
```

---

## 10. Editor UX

### Toolbar Addition

New "Graph" button in `EditorToolbar.tsx` (analogous to "Math" button).

### GraphInsertModal.tsx

New component at `src/components/editor/GraphInsertModal.tsx`:

| Field | Type | Notes |
|---|---|---|
| Graph type | Tab/Radio | Coordinate / Function / Points / Scatter |
| Expression | Text input | Shown for Function type; live parse error |
| X range | Two number inputs | xMin, xMax |
| Y range | Two number inputs | yMin, yMax |
| Grid | Toggle | showGrid |
| Axis labels | Toggle | showAxisLabels |
| Title | Text input | Optional |
| X Label | Text input | Optional (e.g. "x") |
| Y Label | Text input | Optional (e.g. "y") |
| Points editor | Repeatable rows | For Points/Scatter: x, y, label, connect |
| Live preview | 300×200 digital canvas | Technical preview (not handwritten) |
| Insert button | Primary action | Disabled if expression has parse error |

### DOM Insertion

```typescript
const defJson = JSON.stringify(definition);
const escaped = defJson.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const html = `<div class="graph-block" contenteditable="false" data-graph-definition="${escaped}">
  <span class="graph-placeholder">📊 ${definition.title || definition.type}</span>
</div>`;
restoreSavedCaret();
document.execCommand("insertHTML", false, html);
```

---

## 11. Persistence Model

```
GraphDefinition
  ↓ JSON.stringify() + HTML attr escape
  ↓ data-graph-definition attribute in contenteditable DOM
  ↓ 1000ms autosave debounce → IndexedDB
  ↓ Ctrl+S explicit save → Supabase PostgreSQL PATCH
  ↓ Restore: load innerHTML → parse.ts token extraction → JSON.parse → GraphDefinition
```

**Round-trip guarantee:** The JSON definition is fully reconstructed from the stored HTML.
No dependency on transient in-memory state.

---

## 12. Performance Targets

| Operation | Target | Notes |
|---|---|---|
| Parse `GraphDefinition` | <1ms | JSON.parse |
| Expression compile | <1ms | Recursive descent ~120 lines |
| Sample 300 points | <3ms | 300 `evaluate()` + transform calls |
| Draw graph strokes | <20ms | ~300 `inkLine` + ~30 `writeText` calls |
| Total per graph | <25ms | Acceptable in 200–500ms total render |
| 5 graphs per document | <125ms | Total graph overhead; <50% of pipeline budget |

---

## 13. Dependencies

**New runtime dependencies: zero.**

The custom tokenizer, parser, geometry, and renderer are self-contained TypeScript modules.
All charting libraries evaluated (Chart.js, Plotly, D3, function-plot) were rejected due to:
- Digital SVG/Canvas output incompatible with handwritten requirement
- Bundle size overhead (50 KB – 3.5 MB) unjustified for the scope
- No control over stroke rendering aesthetics

---

## 14. Key Architectural Trade-offs

| Decision | Alternative | Why HandText Chose This |
|---|---|---|
| Custom expression parser | math-expression-evaluator (npm) | 120 lines saves a dependency; evaluator covers all required functions |
| JSON GraphDefinition storage | Canvas PNG screenshot | Editable after insertion; survives all persistence layers |
| pen.ts inkLine for curves | Smooth SVG bezier | Matches handwritten paper aesthetic; consistent with text rendering |
| Atomic pagination (no split) | Split graph across pages | A split graph is academically useless and visually broken |
| Separate `src/lib/graph/` subsystem | Extend `src/lib/math/` | Graph semantics are geometric, not algebraic; clean module boundary |

---

## 15. Phased Implementation Plan (Summary)

See [`.planning/phases/graph-support/PLAN.md`](.planning/phases/graph-support/PLAN.md) for the full plan.

| Phase | What ships |
|---|---|
| **Wave 1** | `src/lib/graph/types.ts`, `parser.ts`, `geometry.ts` + unit tests |
| **Wave 2** | `src/lib/graph/layout.ts`, `renderer.ts`, `handwriting.ts`, `index.ts` |
| **Wave 3** | `parse.ts`, `layout.ts`, `renderer.ts` integration changes |
| **Wave 4** | `GraphInsertModal.tsx`, toolbar button, `RichContentEditor` insert handler |
| **Wave 5** | End-to-end browser UAT; ADR-009 finalization |

---

## 16. Related Documents

- [ARCHITECTURE.md](ARCHITECTURE.md) — overall system architecture
- [MATH_NOTATION_ARCHITECTURE.md](MATH_NOTATION_ARCHITECTURE.md) — the parallel math subsystem design
- [decisions/ADR-008-math-notation-architecture.md](decisions/ADR-008-math-notation-architecture.md)
- [decisions/ADR-009-handwritten-graph-architecture.md](decisions/ADR-009-handwritten-graph-architecture.md)
- [.planning/phases/graph-support/CONTEXT.md](../.planning/phases/graph-support/CONTEXT.md)
- [.planning/phases/graph-support/RESEARCH.md](../.planning/phases/graph-support/RESEARCH.md)
- [.planning/phases/graph-support/ARCHITECTURE.md](../.planning/phases/graph-support/ARCHITECTURE.md)
- [.planning/phases/graph-support/UAT.md](../.planning/phases/graph-support/UAT.md)
