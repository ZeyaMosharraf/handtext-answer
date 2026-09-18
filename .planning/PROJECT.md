# HandText — Project Context

> *GSD Project Context — for planning agents and research agents*  
> *Last Updated:* September 2026  
> *Status:* Active

---

## Project Goal

HandText is a browser-based SPA that lets students write academic assignments and renders the output as
authentic handwritten pages on A4 (or other paper sizes). The final product looks like a student
actually wrote their answers by hand — complete with pen strokes, paper texture, ruled lines, and
natural variation.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Vite + React + TypeScript |
| Routing | TanStack Router (file-based) |
| Styling | Vanilla CSS |
| Canvas | HTML5 2D Canvas API (client-side only) |
| Auth | Supabase Auth (GoTrue) |
| Database | Supabase PostgreSQL (cloud, explicit save only) |
| Local Store | Browser IndexedDB (`handtext-local` DB) |
| Export | jsPDF + JSZip |
| Build | Bun + Vite |

## Core Pipeline

```
HTML (contenteditable)
  → parse.ts       (Block[] + Seg[])
  → layout.ts      (FlowItem[] → LayoutDocument)
  → renderer.ts    (Canvas draw calls)
  → pen.ts         (stroke primitives)
```

## Critical Architectural Invariants

1. **`pen.ts` is a pure stroke engine.** It knows nothing about Math, Graph, or document semantics.
2. **Math subsystem (`src/lib/math/`) owns all math concerns.** Parse → AST → 2D box → draw.
3. **Graph subsystem (`src/lib/graph/`) will own all graph concerns.** Isolated from math internals.
4. **`layout.ts` treats composite blocks as atomic `lineUnits`** (table rows, math blocks, future graph blocks).
5. **`renderer.ts` bridges layout placements to canvas** — it dispatches to math/graph subsystems.
6. **No SVGs, no server-side rendering, no third-party charting libraries** unless genuinely justified.
7. **Local-first persistence**: every keystroke → IndexedDB; cloud save is explicit only.

## Completed Phases

| Phase | Description | Status |
|---|---|---|
| M1-P1 | Core handwriting pipeline (parse, layout, renderer, pen) | ✅ Shipped |
| M1-P2 | Persistence (IndexedDB + Supabase cloud) | ✅ Shipped |
| M1-P3 | Design panel (paper, ink, ruling, fonts, templates) | ✅ Shipped |
| M1-P4 | Math notation subsystem | ✅ Shipped |

## Active Deferred Items

- **Question Panel / synchronized left-right workspace**: explicitly deferred, do NOT touch.
- **Graph Support**: next planned feature — see `.planning/phases/graph-support/`.

## Project Constraints

- Must run entirely client-side (no server rendering pipelines).
- Must produce canvas output that looks handwritten (pen strokes, not digital elements).
- Bundle size matters: no heavyweight library introductions without explicit justification.
- No breaking changes to the existing parse → layout → renderer → pen pipeline contract.
