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

**Status:** ✅ Shipped (Commit `1581af1`, 262 unit & integration tests passing)

**Goal:** Allow students to insert academic/scientific graphs (coordinate axes, function plots,
point data, scatter plots) that render as genuinely handwritten content on the A4 page.

**Artifacts:**
- [RESEARCH.md](phases/graph-support/RESEARCH.md)
- [ARCHITECTURE.md](phases/graph-support/ARCHITECTURE.md)
- [PLAN.md](phases/graph-support/PLAN.md)
- [UAT.md](phases/graph-support/UAT.md)

---

### Phase M2-P2 — Math & Document Editing UX Redesign

**Status:** 🔬 Active Planning (Research & Architecture Complete, Plan Ready for Review)

**Goal:** Transform HandText's editing experience into a robust **Hybrid Block-Document Model**
with discrete object interaction for math, tables, and graphs, seamless text continuity, natural
calculator-style math input without raw LaTeX/`\quad`, and precise notebook ruled-line baseline alignment.

**Key constraints:**
- NO application code changes in this phase.
- Final output remains authentic A4 ruled-page canvas renderer with strict pagination.
- Existing tables and graphs preserved 100%.
- Zero-loss backward compatibility with existing drafts and Supabase projects.

**Planning artifacts:**
- [RESEARCH.md](phases/math-document-editor/RESEARCH.md)
- [ARCHITECTURE.md](phases/math-document-editor/ARCHITECTURE.md)
- [CONTEXT.md](phases/math-document-editor/CONTEXT.md)
- [PLAN.md](phases/math-document-editor/PLAN.md)

---

### Phase M2-P3 — Question Panel (Synchronized Workspace)

**Status:** ⏸️ Explicitly deferred — do NOT begin until M2-P2 ships.

**Goal:** Left-right synchronized workspace where question is shown on the left and student answer
is rendered on the right. Complex interaction model requiring careful layout engine changes.

---

## Future Phases (Backlog)

- Export improvements (PDF bookmarks, multi-document batch)
- AI-assisted answer generation refinements
- Mobile / touch input support
- Collaboration / sharing features
