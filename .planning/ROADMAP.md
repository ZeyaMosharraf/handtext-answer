# HandText — Roadmap

> *GSD Roadmap — active milestone and upcoming phases*  
> *Last Updated:* September 2026

---

## Milestone 1 — Core Handwriting Engine ✅ COMPLETE

| Phase | Description | Status |
|---|---|---|
| M1-P1 | Core pipeline: parse, layout, renderer, pen | ✅ Shipped |
| M1-P2 | Persistence: IndexedDB + Supabase cloud | ✅ Shipped |
| M1-P3 | Design panel, paper templates, ink presets | ✅ Shipped |
| M1-P4 | Mathematical notation subsystem (math/) | ✅ Shipped |

---

## Milestone 2 — Academic Content Richness 🔄 ACTIVE

### Phase M2-P1 — Handwritten Graph Support

**Status:** 🔬 Research & Architecture (this planning cycle)

**Goal:** Allow students to insert academic/scientific graphs (coordinate axes, function plots,
point data, scatter plots) that render as genuinely handwritten content on the A4 page — not as
digital charts, screenshots, or SVG overlays.

**Key constraints:**
- New isolated subsystem: `src/lib/graph/`
- Graph pipeline is separate from Math — no cross-contamination of internals
- Reuses `pen.ts` stroke primitives for handwritten appearance
- Graph blocks participate in existing pagination as atomic `lineUnits`
- Graph definitions stored in DOM as structured attributes (not canvas screenshots)

**Planning artifacts:**
- [CONTEXT.md](phases/graph-support/CONTEXT.md)
- [RESEARCH.md](phases/graph-support/RESEARCH.md)
- [ARCHITECTURE.md](phases/graph-support/ARCHITECTURE.md)
- [PLAN.md](phases/graph-support/PLAN.md) *(to be created during plan-phase)*
- [UAT.md](phases/graph-support/UAT.md)

---

### Phase M2-P2 — Question Panel (Synchronized Workspace)

**Status:** ⏸️ Explicitly deferred — do NOT begin until M2-P1 ships.

**Goal:** Left-right synchronized workspace where question is shown on the left and student answer
is rendered on the right. Complex interaction model requiring careful layout engine changes.

---

## Future Phases (Backlog)

- Export improvements (PDF bookmarks, multi-document batch)
- AI-assisted answer generation refinements
- Mobile / touch input support
- Collaboration / sharing features
