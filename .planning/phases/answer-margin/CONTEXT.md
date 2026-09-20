# Phase M2-P4 — Answer-Sheet Layout / Question Margin System: Context & Decisions

> *GSD Context Document — Goals, Invariants, and Locked Design Decisions*  
> *Phase:* M2-P4 (Answer-Sheet Layout / Question Margin System)  
> *Date:* September 2026  
> *Status:* Ready for Planning & Architecture  

---

## 1. Phase Goals

The primary goal of Phase M2-P4 is to provide an authentic **Answer-Sheet Layout / Question Margin System** that mirrors standard university and school exam booklets.

### Core Objectives:
1. **Dedicated Question Margin Column:**
   - Establish an authentic margin zone to the left of the vertical red/grey ruling line where students place question numbers (`Q1`, `Q2`), answer labels (`Ans`), sub-questions (`a)`, `b)`), and marks (`[5M]`).
2. **First-Line Baseline Co-Alignment:**
   - The question marker in the margin must align horizontally with the exact first baseline of the answer content (text, math, table, or graph).
   - Multi-line content wraps naturally in the main writing area without the label repeating or reserving blank lines.
3. **Non-Intrusive LEFT Editor UX (Gutter Chip / Popover):**
   - The LEFT editor remains a clean, digital, responsive editing experience.
   - Hovering/focusing any block displays a subtle margin pill on the left gutter. Clicking opens a quick popover with auto-incrementing presets (`Q1`, `Q2...`, `Ans`, `a)`, `b)...`, `(i)`, `(ii)...`, `Marks`) and freeform custom text.
   - Paragraphs never become rigid form inputs; standard typing, Enter, Backspace, and selection remain 100% natural.
4. **Authentic RIGHT Handwritten Rendering:**
   - Markers are drawn on the A4 page canvas using the active handwriting personality, ink color, and natural organic variation.
5. **Zero-Loss Backward Compatibility:**
   - Existing documents, drafts, and projects without markers continue rendering identically.
   - The question margin can be enabled/disabled and customized in the Design Panel.

---

## 2. Decisions Locked via `/gsd-discuss-phase`

The following 4 decisions were reviewed and locked with the user:

### Decision 1: LEFT Editor Interaction Model
- **Choice:** **Gutter Chip / Popover**.
- **Details:** Hovering or focusing any block reveals a subtle margin tag chip in the left gutter. Clicking it opens a lightweight popover to select standard presets (`Q1`, `Ans`, `a)`, `Marks`) or type custom text. Existing markers display clearly as a pill tag that can be edited or cleared in one click.

### Decision 2: Multi-Page Overflow Policy
- **Choice:** **Start-Page Only**.
- **Details:** When a long question/answer spans across multiple pages (e.g. Page 1 to Page 2), the marker appears only on the page where the question begins, matching authentic exam booklets. Subsequent pages flow cleanly in the main writing area.

### Decision 3: Divider Line & Margin Width Configuration
- **Choice:** **Unified with Page Margin**.
- **Details:** Reuses and integrates with the existing vertical red margin line (`settings.page.margin`). An "Answer Margin" toggle and width slider (default: `72px`, range: `48px`–`120px`) are added to the Design Panel under Page Settings. When enabled, the vertical margin rule serves as the structural divider between the question margin and main writing area.

### Decision 4: Marker Presets & Numbering
- **Choice:** **Smart Auto-Incrementing Presets + Custom Text Input**.
- **Details:** Provides one-click suggestions:
  - Questions: `Q1`, `Q2`, `Q3`... (auto-detects the highest preceding question number and suggests the next one).
  - Answers: `Ans`, `Ans:`
  - Sub-questions: `a)`, `b)`, `c)`... or `(i)`, `(ii)`, `(iii)`...
  - Marks: `[5M]`, `[10M]`
  - Custom: user can type any label desired (e.g. `Step 1`, `Case A`, `OR`).

---

## 3. Strict Scope Invariants (Must NOT Break)

1. **No Separate Document Storage Engine:**
   - Do NOT introduce a new database table or separate document model.
   - Markers attach directly as optional metadata on existing blocks (`TextBlock`, `MathBlock`, `TableBlock`, `GraphBlock`).
2. **No Generic Two-Column or Half-Page Writing:**
   - The main writing area uses the full remaining width of the A4 page (`contentWidth = pageWidth - marginRuleX - 16`).
   - The answer margin is an academic question gutter, not a generic 50/50 split column.
3. **No Absolute CSS Positioning for Content Layout:**
   - HandText layout is driven by `layoutDocument` in `src/lib/handwriting/layout.ts`. Margin coordinates and line baselines are computed deterministically.
4. **All Block Types Supported:**
   - Markers must attach seamlessly to TextBlocks, MathBlocks, TableBlocks, and GraphBlocks.
5. **Persistence & Serialization Invariant:**
   - Survives `blocksToHtml` $\leftrightarrow$ `htmlToBlocks`, IndexedDB drafts, Supabase sync, and copy/paste.

---

## 4. Deferrals (Out of Scope for Phase M2-P4)

- Dynamic grading / teacher marking annotations.
- Right-side margin notes or dual margin columns.
- OCR / handwriting recognition of handwritten margin notes.
