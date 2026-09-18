# M2-P1 — Handwritten Graph Support — CONTEXT

> *GSD Phase Context — produced by gsd-discuss-phase*  
> *Phase:* M2-P1  
> *Date:* September 2026  
> *Status:* Decisions locked — ready for planning

---

## Phase Goal

Allow HandText students to insert academic/scientific graphs into their handwritten A4 assignment.
The graph must render as genuine handwritten content on the page — not as a digital chart, PNG
screenshot, or SVG overlay.

---

## Locked Decisions

These decisions are confirmed and must NOT be re-opened during research or planning:

### D1 — Separate `src/lib/graph/` subsystem

Graph logic lives in `src/lib/graph/`. It is **not** merged into `src/lib/math/`.
Math and Graph are related domains but separate architectural subsystems.

**Rationale:** Math handles symbolic/algebraic expressions with a 2D typesetting box model.
Graph handles geometric data (axes, curves, points) with a Cartesian coordinate system.
Mixing them would create an unmaintainable god-module.

---

### D2 — Handwritten rendering via `pen.ts` primitives only

All visible graph strokes (axes, ticks, curves, labels, title, annotations) must use
`pen.ts` stroke primitives: `inkLine`, `handUnderline`, `writeText`, `writeSegments`.

Graph rendering must NOT produce:
- Digital SVG paths painted onto canvas
- `<canvas>` PNG screenshots embedded as images
- CSS-based charts

**Rationale:** The product promise is authentic handwritten output. Any digital element
breaks the immersion on the final A4 page.

---

### D3 — Graph function evaluation: lightweight custom tokenizer/evaluator

A bespoke lightweight tokenizer + recursive-descent evaluator will handle function graphs.
No third-party graphing library (Chart.js, Plotly, D3, function-plot) will be introduced.

**Supported functions (initial scope):**
- Arithmetic: `+`, `-`, `*`, `/`, `^` (power)
- Built-ins: `sin`, `cos`, `tan`, `sqrt`, `abs`, `log`, `ln`, `exp`
- Constants: `pi`, `e`
- Parentheses grouping

**Rationale:** The function evaluator is a small, self-contained module. Importing a full
graphing library for sampling ~200 points would add 100–500 KB to the bundle with zero benefit
to the handwritten rendering requirement, since those libraries produce SVG/Canvas digital output
that HandText cannot use.

---

### D4 — Graph block is stored as structured JSON definition, NOT a canvas screenshot

Graph definitions are serialized as a structured JSON string and stored in the DOM as:

```html
<div class="graph-block" contenteditable="false"
     data-graph-definition="{...}">
  <!-- visual placeholder only -->
</div>
```

The `data-graph-definition` attribute stores the complete `GraphDefinition` object (serialized JSON).
The DOM placeholder is for editor preview only. The authoritative source is always
`data-graph-definition`.

**Rationale:** Storing a canvas screenshot loses all editability. The definition must survive
IndexedDB drafts, cloud saves, reloads, and restores. The definition is re-evaluated on every
render, just like `data-latex` is re-parsed on every render for math blocks.

---

### D5 — Graph pagination: atomic (never split across pages)

If a graph block does not fit in remaining page space, the entire graph moves to the next page.
A graph is NEVER split mid-axes across a page boundary.

**Rationale:** A graph split across two pages is visually broken and academically useless. This is
the same policy applied to table rows and math blocks in the existing layout engine.

---

### D6 — Graph coordinate system is graph-local, NOT the page ruling grid

The graph has its own internal Cartesian coordinate system:

```
GraphSpace { xMin, xMax, yMin, yMax, originX, originY, scaleX, scaleY }
```

Page-level ruled lines must NOT be used as graph coordinate grid lines.

The graph is composed in graph-local coordinates, then placed at the `contentLeft` coordinate
determined by `layout.ts`, exactly as math blocks are placed.

**Rationale:** Ruled lines have fixed spacing tied to the handwriting font size. A graph's
coordinate scale is determined by the data range, not the paper layout.

---

### D7 — Randomness: visual jitter only, geometry deterministic

`pen.ts`-level randomness (baseline jitter, stroke width variation, ink alpha variation)
applies to the visual appearance of graph strokes — but ONLY to appearance.

The following MUST remain deterministic:
- Axis tick positions
- Curve sample points
- Point marker coordinates
- Grid line geometry
- Function domain/range
- Scale transforms

**Rationale:** A student relying on HandText to show `y = x^2` passing through `(2, 4)` must
be confident that the rendered point is at `(2, 4)`, not jittered to `(2.03, 4.11)`.

---

### D8 — Math ↔ Graph boundary: shared pen.ts only; no shared internals

The Math subsystem (`src/lib/math/`) and Graph subsystem (`src/lib/graph/`) are independent.
They share ONLY `pen.ts` for stroke rendering.

Graph labels (axis labels, point labels, title) will use `pen.ts` `writeText` / `writeSegments`
directly — NOT `parseMath` / `layoutMath`.

If a graph label contains a mathematical expression (e.g., `y = x²`), a future enhancement
may call `layoutMath` for that specific label — but this is OUT OF SCOPE for M2-P1.
M2-P1 labels are plain handwritten text rendered via `writeText`.

---

### D9 — Editor UX: GraphInsertModal with graph type selector

A `GraphInsertModal` component will handle graph insertion. It will have:
- Graph type selector: Coordinate / Function / Points / Scatter
- Function input field (for function graphs)
- X range and Y range inputs
- Grid toggle
- Axis labels toggle
- Graph title input
- "Insert Graph" button

A **technical preview** canvas (digital, not handwritten) is acceptable inside the modal
for real-time feedback while editing graph parameters. The FINAL inserted graph on the A4
page always uses the handwritten renderer.

---

### D10 — Multiple graphs per document are supported

Multiple `graph-block` DOM nodes can exist in the same document. Each has its own
`data-graph-definition` attribute. The pagination system handles them as independent atomic blocks.
No graph may overlap or overwrite another graph's space.

---

## Out of Scope for M2-P1

The following items are explicitly deferred:

- Math-labeled graph axes using the Math subsystem (e.g., rendering `x²` as a proper math glyph in a graph axis label)
- Click-on-graph-to-edit UX (selection and inline editing)
- Polar coordinate graphs
- Parametric curves
- Multi-function overlay on one graph
- 3D graphs
- Dynamic graph animation
- Question Panel (deferred independently)

---

## What This Context Enables

Research and planning agents can proceed to:

1. Design the `GraphDefinition` JSON schema
2. Design the `src/lib/graph/` file structure
3. Research function tokenizer/evaluator design
4. Research `inkLine`-based axis/curve rendering
5. Design `GraphLayoutBox` interface analogous to `MathLayoutBox`
6. Design the `data-graph-definition` parse → flow → placement → render pipeline
7. Design the `GraphInsertModal` component
8. Write the full implementation `PLAN.md`
