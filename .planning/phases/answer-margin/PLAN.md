# Phase M2-P4 — Answer-Sheet Layout / Question Margin System: Implementation Plan

> *GSD Plan Document — Step-by-Step Execution, Testing Matrix, and Acceptance Criteria*  
> *Phase:* M2-P4 (Answer-Sheet Layout / Question Margin System)  
> *Date:* September 2026  
> *Status:* Ready for Execution  

---

## 1. Execution Overview

The phase is structured into six sequential, test-driven phases:

```
Phase 1: Types & Serialization Contract
  ├── src/types/document.ts (MarginMarker interface)
  ├── src/lib/handwriting/types.ts (AnswerMarginConfig)
  └── src/lib/editor/blockSerialization.ts (HTML attributes & round-trip)

Phase 2: Handwriting Parser & Layout Geometry
  ├── src/lib/handwriting/parse.ts (Extract data-margin-marker)
  └── src/lib/handwriting/layout.ts (Gutter coordinates, flow binding, baseline alignment)

Phase 3: Handwriting Canvas Renderer
  └── src/lib/handwriting/renderer.ts (Margin rule & handwritten marker rendering)

Phase 4: Design Panel Integration
  └── src/components/editor/DesignPanel.tsx (Answer Margin toggle, width slider, divider)

Phase 5: LEFT Editor Gutter Chip & Popover
  ├── src/components/editor/MarginMarkerChip.tsx (New component)
  └── src/components/editor/RichContentEditor.tsx (Block gutter display & popover)

Phase 6: Verification, Testing & Browser UAT
  ├── tests/test-answer-margin.ts (Automated test suite)
  ├── TypeScript check (npx tsc --noEmit)
  ├── Production build (npm run build)
  └── Browser UAT on http://localhost:8080/editor/dev
```

---

## 2. Detailed Work Breakdown

### Phase 1: Types & Serialization Contract
- Define `MarginMarker`:
  ```typescript
  export interface MarginMarker {
    type: "question" | "answer" | "subquestion" | "marks" | "custom";
    text: string;
    color?: string | undefined;
  }
  ```
- Extend `BaseBlock` in `src/types/document.ts`.
- Add `answerMargin?: { enabled: boolean; width: number; showDivider?: boolean }` to `PageConfig` in `src/lib/handwriting/types.ts`.
- Update `blocksToHtml` and `htmlToBlocks` in `src/lib/editor/blockSerialization.ts`:
  - Serialize `marginMarker` as `data-margin-marker="..."` and `data-margin-type="..."`.
  - Restore `marginMarker` during deserialization.
  - Verify 100% roundtrip idempotency on existing and new blocks.

### Phase 2: Handwriting Parser & Layout Geometry
- In `src/lib/handwriting/parse.ts`:
  - Parse `data-margin-marker` from HTML elements (`p`, `h1-h6`, `div.math-block`, `div.table-block`, `div.graph-block`).
  - Set `block.marginMarker`.
- In `src/lib/handwriting/layout.ts`:
  - Calculate `marginRuleX`, `marginMarkerLeft`, `contentLeft`, and available content width.
  - Bind `block.marginMarker` to the **first** flow item of the block.
  - Ensure math, table, and graph blocks respect the new content width bounds.

### Phase 3: Handwriting Canvas Renderer
- In `src/lib/handwriting/renderer.ts`:
  - Render the vertical margin divider line at `marginRuleX` spanning from header to footer.
  - When drawing a placement with `placement.marginMarker`:
    - Compute `markerBaselineY = getBaseline(page.coordinates, placement.lineIndex)`.
    - Draw marker text with `writeSegments` in the margin zone using the active handwriting personality.
  - Multi-page continuation: placements on continuation pages have no `marginMarker`, keeping the margin clean.

### Phase 4: Design Panel Integration
- In `src/components/editor/DesignPanel.tsx`:
  - Add "Answer Margin" section in the Page tab.
  - Add switch for enabling/disabling the question margin.
  - Add slider for margin width (default `72px`, range `54px`–`110px`).
  - Add toggle for vertical divider visibility.

### Phase 5: LEFT Editor Gutter Chip & Popover
- Create `src/components/editor/MarginMarkerChip.tsx`:
  - Displays as a subtle pill in the left margin/gutter.
  - On click, opens popover with presets: `Q1, Q2, ...`, `Ans`, `a), b), c)...`, `(i), (ii)...`, `[5M]`, `[10M]`.
  - Freeform input for custom text.
  - Clear button to remove marker.
- Integrate into `RichContentEditor.tsx`:
  - Ensure standard typing, selection, Backspace, and Enter are completely unobstructed.

### Phase 6: Automated Testing & Browser UAT
- Create `tests/test-answer-margin.ts` with 25+ assertions covering:
  1. `MarginMarker` creation on Text, Math, Table, and Graph blocks.
  2. Serialization roundtrip (`blocksToHtml` $\leftrightarrow$ `htmlToBlocks`).
  3. Margin coordinate computation and content width reduction.
  4. First baseline co-alignment between marker and content.
  5. Multi-line wrapping behavior without marker duplication.
  6. Page break handling: marker on Page 1, Page 2 continues cleanly.
  7. Math block with question marker (`Q3` + Matrix).
  8. Table block with question marker (`Q4` + Table).
  9. Graph block with question marker (`Q5` + Graph).
  10. Backward compatibility with legacy documents without markers.
- Run `npx tsc --noEmit` and `npm run build`.
- Execute comprehensive browser UAT on `http://localhost:8080/editor/dev`.

---

## 3. Acceptance Criteria

1. **Academic Answer Sheet Aesthetic:** Output visually reflects a real university examination booklet with question numbers and labels aligned on the left of the margin line.
2. **Zero Text Interference:** Typing, Enter, backspace, and cursor navigation inside the editor operate naturally without input form box constraints.
3. **Multi-Block Coexistence:** Works flawlessly with `TextBlock`, `MathBlock`, `TableBlock`, and `GraphBlock`.
4. **Baseline Synchronization:** The marker's handwritten baseline matches the first line of the answer block.
5. **Clean Multi-Page Spanning:** Markers do not float, repeat erratically, or become detached when an answer crosses page boundaries.
6. **Backward Compatibility:** All existing documents without markers render identically with zero regressions.
