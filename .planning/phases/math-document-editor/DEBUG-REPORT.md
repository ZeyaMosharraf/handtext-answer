# Root Cause Debugging Report: Phase 2 Editor TextBlock Form-Input Rendering

**Date:** 2026-09-18  
**Phase:** Math & Document Editor — Phase 2 UX Debugging  
**Status:** Root Cause Identified — No Code Modified Yet

---

## 1. Exact Visual Problem

When inspecting the editor workspace in the browser:
- The left **Content Editor** pane displays the Toolbar at the top, followed by a tiny, isolated rectangular box (~24px high) with a visible border outline (`ring-1`) and a tinted background (`bg-primary/5`), followed by a large expanse of unstyled empty whitespace.
- Text typing feels like filling out an isolated HTML `<input type="text">` or single-line form control rather than writing on a continuous document page.
- Visual hierarchy and document prose typography (paragraph spacing, margins, lists, headings) are absent from the editor container.
- The editor's previous "card" writing surface (which had a rounded border, card background, 16px padding, and full-height canvas) is missing, leaving the content floating on the raw background.

---

## 2. Root Cause Analysis

The problem is caused by a dual architectural failure in visual separation:

1. **Misapplied Object Semantics onto TextBlock (`TextBlockView.tsx`):**
   - In Phase 2, the design pattern for *Discrete Document Objects* (MathBlock, TableBlock, GraphBlock) required clear object outlines, hover states, selection rings, and action chips (`[Edit] [Delete]`).
   - However, this styling was mistakenly applied to `TextBlockView.tsx` as well (`focus:ring-1 focus:ring-primary/20`, `isSelected && "bg-primary/5 ring-1 ring-primary/40"`, `rounded-sm py-1 px-1`).
   - Consequently, whenever the user focuses or selects a TextBlock, a 1px border ring and tinted background are drawn tightly around the 24px text element, giving it the exact visual semantics of a form input control.

2. **Loss of the Unified Document Canvas Container (`RichContentEditor.tsx`):**
   - In pre-Phase-2, `RichContentEditor.tsx` rendered the outer writing canvas as an integrated card:
     ```tsx
     "min-h-0 flex-1 rounded-lg border border-input bg-card p-4 text-base leading-relaxed text-foreground cursor-text focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere] [&_p]:mb-2.5 [&_ul]:... [&_ol]:..."
     ```
   - In Phase 2, `RichContentEditor.tsx` stripped this entire card structure and prose rules, rendering only:
     ```tsx
     "rich-content-editor-host relative w-full flex-1 min-h-0 text-sm leading-relaxed"
     ```
   - All card styling (`rounded-lg border border-input bg-card p-4`), base font sizing (`text-base`), and prose typography were dropped.
   - The editor surface became an invisible, unstyled container, while individual text blocks were styled as bounded boxes.

3. **Premature Block Splitting on Enter (`TextBlockView.tsx`):**
   - `TextBlockView.tsx` intercepted `Enter` (`if (e.key === "Enter" && !e.shiftKey && isAtEnd)`) and called `onEnterAtEnd()`, creating a **brand new TextBlock** for every single newline.
   - Because each TextBlock had focus rings, backgrounds, and flex gaps, pressing Enter created another bordered input box beneath the first, fragmenting normal paragraph writing into a vertical list of form fields.

---

## 3. Relevant Components & CSS

| File | Lines | Specific Cause |
|---|---|---|
| `src/components/editor/TextBlockView.tsx` | 180–185 | Applies `focus:ring-1 focus:ring-primary/20`, `isSelected && "bg-primary/5 ring-1 ring-primary/40"`, `rounded-sm py-1 px-1` directly to the `text-block-view` contenteditable `div`. |
| `src/components/editor/TextBlockView.tsx` | 143–150 | Intercepts standard `Enter` key events and forces creation of a new `TextBlock` instead of allowing natural paragraphs (`<p>`/`<br>`) inside the TextBlock. |
| `src/components/editor/RichContentEditor.tsx` | 638–644 | `rich-content-editor-host` container lacks `rounded-lg border border-input bg-card p-4 text-base cursor-text` and all document typography prose rules (`[&_p]:mb-2.5`, `[&_ul]:...`, etc.). |
| `src/components/editor/BlockListContainer.tsx` | 150 | `block-list-container` uses `flex flex-col gap-1 min-h-full cursor-text pb-16`. The `gap-1` separates text blocks with rigid flex gaps instead of standard document paragraph margins. |

---

## 4. Why Phase 2 Produced This Behavior

Phase 2 aimed to establish "Block Views, Discrete Object Selection & Natural Text Continuation." During implementation:
- The specification for *Discrete Object Selection* was applied indiscriminately across all block types, including `TextBlock`.
- Normal text editing was mistakenly conceptualized as "editing an individual block widget" instead of "writing on a continuous document canvas where non-text objects are embedded."
- The outer container styles were stripped from `RichContentEditor` under the false assumption that individual block views would handle their own presentation, forgetting that body text requires an outer document canvas to provide margins, padding, typography, and comfortable writing area.

---

## 5. Correct UX Behavior

### Separation of Concerns: Document Block vs. Editor Surface

```
┌─────────────────────────────────────────────────────────────┐
│ Editor Surface (RichContentEditor / BlockListContainer)      │
│ - Full height card (flex-1 h-full bg-card border rounded-lg)│
│ - Padded document canvas (p-4 text-base leading-relaxed)     │
│ - Global prose typography (&_p:mb-2.5, lists, headings)     │
│                                                             │
│   TextBlockView (Completely borderless, ringless, seamless) │
│   Paragraph 1: Normal flowing text in the document.         │
│   Paragraph 2: Multiple lines, natural Enter paragraphs.    │
│                                                             │
│   MathBlockView (Discrete Object Widget)                    │
│   ┌───────────────────────────────────────────────────────┐ │
│   │ [Σ] Z1 = X1 W11 + X2 W21       [Edit] [Delete]        │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                             │
│   TextBlockView (Completely borderless, ringless, seamless) │
│   Paragraph 3: Text continues seamlessly below math.        │
│                                                             │
│   (Clicking empty canvas space below places caret at end)   │
└─────────────────────────────────────────────────────────────┘
```

1. **TextBlockView:**
   - Must be **completely invisible visually** during normal editing.
   - Zero persistent borders. Zero focus rings. Zero background tints. Zero input-like padding.
   - Sizes naturally with its content; supports multi-line text, multiple paragraphs (`<p>`), lists (`<ul>`/`<ol>`), bold/italic/color formatting.
   - Enter within text creates normal paragraphs without fragmenting the block.
2. **Editor Canvas (`RichContentEditor` / `BlockListContainer`):**
   - Provides the comfortable, full-height writing surface: `rounded-lg border border-input bg-card p-4 text-base text-foreground cursor-text`.
   - Clicking anywhere in the canvas (including empty space below) focuses the text writing surface.
3. **Discrete Objects (Math, Table, Graph):**
   - Retain their clear object borders, hover highlights, selection rings, and action chips (`[Edit] [Delete]`).

---

## 6. Minimal Architectural Correction

1. **`src/components/editor/TextBlockView.tsx`:**
   - Strip all form-input styles: remove `focus:ring-1 focus:ring-primary/20`, `rounded-sm py-1 px-1`, and `isSelected && "bg-primary/5 ring-1 ring-primary/40"`.
   - Set styling to clean borderless text flow: `text-block-view relative w-full outline-none text-base leading-relaxed cursor-text`.
   - Allow natural multi-paragraph editing within TextBlock; only delegate block splitting to explicit object insertions (Math, Table, Graph).
2. **`src/components/editor/RichContentEditor.tsx`:**
   - Restore the outer document canvas styling:
     ```tsx
     "min-h-0 flex-1 rounded-lg border border-input bg-card p-4 text-base leading-relaxed text-foreground outline-none transition-colors cursor-text focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]"
     ```
   - Restore the comprehensive prose typography rules (`[&_p]:mb-2.5`, `[&_ul]:...`, `[&_ol]:...`, `[&_blockquote]:...`, `[&_table]:...`, etc.) so headings, lists, and paragraphs render with proper document spacing.
3. **`src/components/editor/BlockListContainer.tsx`:**
   - Remove disruptive `gap-1` between consecutive text elements; let typography margins (`mb-2.5`) govern text rhythm.
   - Ensure clicking in empty canvas space below content focuses the last TextBlock and places the caret at the end cleanly without creating redundant empty blocks.

---

## 7. Files That Should Change

1. `src/components/editor/TextBlockView.tsx` — Remove rings, borders, and input backgrounds; preserve rich text flow.
2. `src/components/editor/RichContentEditor.tsx` — Restore canvas card container, padding, base font sizing, and prose typography rules.
3. `src/components/editor/BlockListContainer.tsx` — Refine layout and canvas click-to-focus behavior.

---

## 8. Files That Must NOT Change

- `src/types/document.ts` — Block types and invariants are sound.
- `src/lib/editor/blockSerialization.ts` — HTML round-trip and legacy migration are 100% verified.
- `src/lib/editor/documentOperations.ts` — Immutable block state operations are sound.
- `src/hooks/useDocumentBlocks.ts` — State hook and history management are sound.
- `src/components/editor/MathBlockView.tsx` — Object selection and action chips are correct.
- `src/components/editor/TableBlockView.tsx` — Table object encapsulation is correct.
- `src/components/editor/GraphBlockView.tsx` — Graph object encapsulation is correct.
- `src/components/editor/EditorWorkspace.tsx` — Outer grid, toolbar, preview, and AI assistant wiring are correct.
- `src/lib/handwriting/*` — A4 pagination and handwriting engines must remain untouched.

---

## 9. Regression Risks & Mitigations

1. **Test Suite Compatibility (`tests/test-phase2-editor-blocks.ts`):**
   - *Risk:* Automated tests may verify classes or attributes on `TextBlockView`.
   - *Mitigation:* Retain `text-block-view` CSS class and `data-block-id` / `data-block-type="text"` attributes.
2. **Caret Focus and Placement:**
   - *Risk:* Clicking empty canvas space could fail to focus or lose caret position.
   - *Mitigation:* Ensure `handleContainerClick` accurately targets the last TextBlock and invokes `focus(true)` (caret at end).
3. **Toolbar Commands (`document.execCommand`):**
   - *Risk:* Toolbar bold/italic/underline/color actions rely on an active text selection.
   - *Mitigation:* Contenteditable stays on `TextBlockView`; removing outline rings does not affect `Selection` or `Range` APIs.

---

## 10. Browser Verification Plan

1. **Document Canvas Rendering:**
   - Confirm the editor appears as a full-height, comfortable card (`bg-card border border-input rounded-lg p-4`) filling the left pane.
2. **Natural Text Writing:**
   - Type multiple paragraphs, headers, and bulleted lists.
   - Verify: zero visible borders, zero rings, zero form-input outlines around text.
   - Verify text flows seamlessly with `text-base` font and proper paragraph spacing (`mb-2.5`).
3. **Discrete Object Selection:**
   - Insert Math formula: verify it appears as an embedded object chip (`[Σ formula | Edit | Delete]`) with visible border and action chips on selection/hover.
   - Verify text above and below the Math formula remains seamless and borderless.
4. **Canvas Click Behavior:**
   - Click in the empty space below content: confirm caret jumps to the end of the text without creating extra boxes.
5. **Automated Test Validation:**
   - Run `npx tsx tests/test-phase2-editor-blocks.ts` (must pass 100%).
   - Run `npm run build` and `npx tsc --noEmit` (clean build, 0 errors).
