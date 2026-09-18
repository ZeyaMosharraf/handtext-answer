# Handwritten Graph Support — Implementation Plan

> **Phased Implementation Plan for Handwritten Graph Rendering**  
> *Status:* Approved — Ready for Execution  
> *Architecture Reference:* [GRAPH_NOTATION_ARCHITECTURE.md](./GRAPH_NOTATION_ARCHITECTURE.md)  
> *ADR Reference:* [ADR-009](./decisions/ADR-009-handwritten-graph-architecture.md)  
> *Full Plan (GSD):* [.planning/phases/graph-support/PLAN.md](../.planning/phases/graph-support/PLAN.md)  
> *Last Updated:* September 2026

---

## Scope Summary

Implement a complete handwritten graph support system in 6 phases covering:

1. Graph types, function expression parser, coordinate geometry
2. GraphLayoutBox and lineUnits computation  
3. Handwritten stroke renderer (all via pen.ts)
4. Pipeline integration (parse.ts → layout.ts → renderer.ts)
5. Editor UX (GraphInsertModal, toolbar button)
6. End-to-end verification (14 UAT cases + full regression suite)

**Zero new runtime dependencies. pen.ts unchanged. Backward compatible.**

---

## Phase Overview

| Phase | Goal | Key Files |
|---|---|---|
| 1 | Core: types, parser, geometry | `graph/types.ts`, `graph/parser.ts`, `graph/geometry.ts` |
| 2 | Layout engine | `graph/layout.ts` |
| 3 | Handwriting renderer | `graph/handwriting.ts`, `graph/renderer.ts`, `graph/index.ts` |
| 4 | Pipeline integration | `parse.ts`, `layout.ts`, `renderer.ts` (extends) |
| 5 | Editor UX | `GraphInsertModal.tsx`, `EditorToolbar.tsx`, `RichContentEditor.tsx` |
| 6 | Full verification | All tests, UAT, build |

---

## Files Created/Modified

| File | Status |
|---|---|
| `src/lib/graph/types.ts` | NEW |
| `src/lib/graph/parser.ts` | NEW |
| `src/lib/graph/geometry.ts` | NEW |
| `src/lib/graph/layout.ts` | NEW |
| `src/lib/graph/handwriting.ts` | NEW |
| `src/lib/graph/renderer.ts` | NEW |
| `src/lib/graph/index.ts` | NEW |
| `src/lib/handwriting/parse.ts` | EXTEND |
| `src/lib/handwriting/layout.ts` | EXTEND |
| `src/lib/handwriting/renderer.ts` | EXTEND |
| `src/lib/handwriting/pen.ts` | **UNCHANGED** |
| `src/lib/math/` (all files) | **UNCHANGED** |
| `src/components/editor/GraphInsertModal.tsx` | NEW |
| `src/components/editor/EditorToolbar.tsx` | EXTEND |
| `src/components/editor/RichContentEditor.tsx` | EXTEND |
| `tests/test-graph-core.ts` | NEW |
| `tests/test-graph-layout.ts` | NEW |
| `tests/test-graph-pipeline.ts` | NEW |

---

## Verification Commands

```bash
# New graph tests
npx tsx tests/test-graph-core.ts
npx tsx tests/test-graph-layout.ts
npx tsx tests/test-graph-pipeline.ts

# Regression (must stay green)
npx tsx tests/test-math-parser.ts
npx tsx tests/test-math-layout.ts
npx tsx tests/test-math-pagination.ts
npx tsx tests/test-table-cell-height.ts
npx tsx tests/test-table-operations.test.ts
npx tsx tests/test-restoration-idempotency.ts

# Build
npx tsc --noEmit
npm run build
```

> For the full detailed plan with deliverable checklists, test specifications, and
> risk register, see [`.planning/phases/graph-support/PLAN.md`](../.planning/phases/graph-support/PLAN.md).
