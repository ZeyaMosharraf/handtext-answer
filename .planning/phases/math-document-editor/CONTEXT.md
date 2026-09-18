# M2-P2 — Math & Document Editing UX Redesign — Context & Boundaries

> *GSD Context Document — Phase Goals, Invariants, and Scope Boundaries*  
> *Phase:* M2-P2  
> *Date:* September 2026  
> *Status:* Active Planning  

---

## 1. Phase Goals

The primary goal of Phase M2-P2 is to replace HandText's fragile, monolithic contenteditable Math insertion mechanism with a robust **Hybrid Block-Document Architecture** and **Handwriting-Aligned Math Engine**.

### Core Deliverables:
1. **Hybrid Block-Document Model:**
   - Ordered list of typed blocks: `TextBlock`, `MathBlock`, `TableBlock`, `GraphBlock`.
   - Distinct object selection for non-text blocks (selection boundary, action chips, delete on Backspace, edit on Enter/double-click).
   - Flawless insertion and editing state machines that guarantee no formula can ever overwrite another formula.
   - Effortless text continuity: inserting a math block automatically creates and focuses a subsequent text block.
2. **Smart Natural Math Input:**
   - Calculator-style math input that handles variables with subscripts (`Z1 = X1 W11 + X2 W21`), exponents (`x^2`), fractions (`a/b`), square roots (`sqrt(x)`), and natural horizontal spacing without requiring `\quad` or raw LaTeX knowledge.
   - Advanced LaTeX toggle available for power users.
   - Real-time handwriting preview in the input modal.
3. **Mathematical Ruled-Line Layout Corrections:**
   - Anchor math baseline strictly to `ruledLineY` so math sits on the notebook line rather than floating above it.
   - Fix `computeLineUnits` threshold to allow single-line formulas with superscripts/subscripts ($x^2$, $x_1$) to stay on a single lineUnit ($28\text{px}$) instead of inflating to 2 lines ($56\text{px}$).
   - Compact fraction and delimiter vertical sizing.
4. **100% Backward-Compatible Persistence:**
   - Seamless two-way `blocksToHtml` and `htmlToBlocks` converter ensuring all existing drafts and Supabase projects load without data loss.

---

## 2. Invariants (Must NOT Break)

1. **A4 Ruled-Line Pagination:**
   - The final output must remain authentic A4 ruled handwritten pages rendered via Canvas.
   - Layout coordinates (`PageCoordinateSystem`), page margins, content bounds, and line indices must be preserved.
2. **Existing Table Subsystem:**
   - All table features (compact rows, column resize, cell alignments, multi-page repeated headers) must remain completely functional as a `TableBlock`.
3. **Existing Graph Subsystem (M2-P1):**
   - The newly shipped Handwritten Graph pipeline must fit directly as a `GraphBlock` with zero regression.
4. **Offline Autosave & Cloud Sync:**
   - IndexedDB local draft storage and Supabase project saving must continue working seamlessly through the serialization layer.
5. **No Visual Degradation:**
   - Handwriting pen aesthetics (ink variations, organic wobble, baseline jitter) must remain faithful to real notebook penmanship.

---

## 3. Explicit Deferrals (Out of Scope for M2-P2)

1. **Question Panel (Synchronized Workspace):**
   - Strictly deferred to M2-P3. Do NOT create or touch the left-right split screen or question panel during this phase.
2. **Freeform Infinite Canvas:**
   - HandText is a ruled A4 notebook tool, not a freeform whiteboard. No arbitrary drag-and-drop $(X, Y)$ coordinate systems.
3. **Collaboration / Multiplayer Editing:**
   - Real-time CRDT / WebRTC collaboration is reserved for future milestones.
4. **Graph Subsystem Modification:**
   - Do not alter `src/lib/graph/` evaluation or rendering. Wrap it cleanly in a `GraphBlock`.

---

## 4. Key Architectural Decisions Summary

- **ADR-010: Hybrid Block-Flow Architecture:** The editor is structured as a typed list of blocks with discrete object interaction for non-text blocks, compiling directly into vertical flow items on ruled lines.
- **ADR-011: Smart Natural Math Grammar:** Natural expressions are pre-parsed into standard LaTeX prior to KaTeX AST generation, eliminating student LaTeX friction.
- **ADR-012: Baseline Ruled-Line Anchor:** Math baselines are anchored directly to ruled lines without artificial descent lifting.
- **ADR-013: 1.35x Ruling Spacing Tolerance:** Formulas with simple superscripts/subscripts are preserved on 1 lineUnit.
