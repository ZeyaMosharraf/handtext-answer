# ADR-009: Handwritten Graph Support Architecture

- **Status**: Proposed `[PLANNED — Pending Implementation]`
- **Date**: September 2026
- **Context**: HandText students frequently need to include scientific and mathematical graphs (coordinate axes, function plots, point data) in their handwritten assignments. The final A4 canvas output must render graphs in the same handwritten personality as surrounding text — pen strokes, not digital chart elements.

- **Decision**:
  1. Build a bespoke, zero-dependency graph subsystem in `src/lib/graph/` covering function expression parsing, Cartesian geometry computation, and handwritten vector stroke rendering.
  2. Adopt a **Structured JSON Definition Model**: `GraphDefinition` objects serialized as JSON stored in `data-graph-definition` attributes on `contenteditable="false"` DOM nodes.
  3. Graph blocks are stored in the editor as `contenteditable="false"` DOM nodes with `data-graph-definition` attributes containing a full `GraphDefinition` JSON string.
  4. Graph blocks participate in the existing pagination system as **atomic flow units** (never split across pages), consuming integer `lineUnits` computed from their total height divided by `rulingSpacing`.
  5. The rendering pipeline remains: `parse.ts` → `layout.ts` → `renderer.ts` → `pen.ts`. The graph module integrates at `layout.ts` (for bounding-box/lineUnits calculation) and `renderer.ts` (for draw call dispatch). `pen.ts` remains strictly a glyph/ink/stroke primitive engine.

- **Rejected Alternatives**:
  - **Chart.js** (~200 KB): Produces digital Canvas/SVG output. Digital appearance incompatible with handwritten immersion.
  - **Plotly.js** (~3.5 MB): Massive bundle, digital SVG output, server-optional — none compatible with requirements.
  - **D3.js** (~280 KB): SVG-based; produces DOM elements, not canvas pen strokes.
  - **function-plot** (~50 KB + D3): SVG output; depends on D3.
  - **mathjs** (~600 KB): Massively oversized for simple `f(x)` evaluation with ~8 supported functions.
  - **Canvas screenshot storage**: Loses editability; definition cannot be recovered after save/reload.

- **Reason**:
  - All existing charting/graphing libraries produce **digital-looking output** (SVG, Canvas with smooth bezier curves). None produce canvas-native handwritten pen strokes.
  - A purpose-built ~6-file, ~20 KB lightweight subsystem gives 100% control over rendering aesthetics, zero external dependencies, and negligible bundle impact.
  - The `GraphDefinition` JSON model ensures graphs survive all persistence layers (IndexedDB, Supabase, HTML round-trips) and remain editable after insertion.

- **Consequences**:
  - **Positive**: Authentic handwritten graph output; zero bundle bloat; full control over aesthetics; pen.ts isolation preserved.
  - **Positive**: Graphs coexist cleanly with paragraphs, headings, math blocks, tables, and multi-page pagination.
  - **Positive**: Graph definitions are editable — the JSON definition can be parsed and re-displayed in the GraphInsertModal.
  - **Neutral**: Requires implementing a bespoke tokenizer, parser, geometry module, and renderer (~6 TypeScript files).
  - **Negative**: Initial function evaluator coverage is limited to standard academic functions; exotic expressions require parser extension.

- **Full Architecture**: See [`.planning/phases/graph-support/ARCHITECTURE.md`](../../.planning/phases/graph-support/ARCHITECTURE.md)
- **Research**: See [`.planning/phases/graph-support/RESEARCH.md`](../../.planning/phases/graph-support/RESEARCH.md)
- **Phase Plan**: See [`.planning/phases/graph-support/PLAN.md`](../../.planning/phases/graph-support/PLAN.md) *(to be created during gsd-plan-phase)*
- **UAT Criteria**: See [`.planning/phases/graph-support/UAT.md`](../../.planning/phases/graph-support/UAT.md)
