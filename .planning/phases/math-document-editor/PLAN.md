# M2-P2 — Math & Document Editing UX Redesign — Phased Implementation Plan

> *GSD Phase Plan — Implementable, Step-by-Step Engineering Roadmap*  
> *Phase:* M2-P2  
> *Date:* September 2026  
> *Status:* Plan Reviewed & Refined — Ready for Execution (Pending User Approval)  

---

## 1. Architectural Principles & Foundation Strategy

This plan implements the **Hybrid Block-Document Model** and **Handwriting Math Refinement** developed during Phase M2-P2 research.

### Critical Strategy: Block Document Core First (No More Isolated Patches)
Previous iterations applied incremental patches to `contenteditable` selection ranges, toolbar click handlers, and DOM widgets. These patches repeatedly broke because **a single monolithic `contenteditable` container is fundamentally incapable of reliable non-text object handling**.

This plan enforces that **the Block Document Core is the architectural foundation (Phase 1)**:
- Math becomes a first-class `MathBlock` with its own stable UUID.
- Creating a new Math block is an atomic document operation that **can never edit, overwrite, or mutate an existing formula**.
- Normal text is a first-class `TextBlock`. Inserting a Math block **automatically creates and focuses a subsequent `TextBlock`**, giving users natural, uninterrupted typing without wrestling with modal focus or widget boundaries.
- The Table subsystem and Graph subsystem are wrapped cleanly as `TableBlock` and `GraphBlock` with **zero rewrite of working functionality**.
- The existing persistence contract (semantic HTML string for IndexedDB drafts and Supabase cloud projects) is preserved 100% via a lossless two-way adapter (`htmlToBlocks` $\leftrightarrow$ `blocksToHtml`).

### Status of Math Baseline & Vertical Whitespace:
- **Root causes identified:** Over-sensitive $1.05\times$ threshold in `computeLineUnits()` inflating $x^2$ to 2 lines ($56\text{px}$); artificial `baselineY = ruledLineY - box.descent` shift in `renderer.ts` lifting formulas off ruled lines.
- **Proposed corrections documented:** Raise single-line threshold to $1.35\times$ ruling spacing; anchor baseline strictly to `ruledLineY`; tighten fraction bar padding.
- **Implementation & Visual Verification Pending:** Addressed and visually verified in Phase 4 of this plan.

---

## 2. Phased Implementation Roadmap

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: HYBRID BLOCK-DOCUMENT CORE & BACKWARD-COMPATIBLE SERIALIZATION          │
│          (Foundation: Typed Blocks, Stable UUIDs, htmlToBlocks, blocksToHtml)   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: EDITOR UI OVERHAUL — BLOCK VIEWS, OBJECT SELECTION & CONTINUITY         │
│          (TextBlockView, MathBlockView, TableBlockView, Auto-Focus Next Block)   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: SMART NATURAL MATH PARSER & MODAL INTERACTION                           │
│          (Natural Syntax, Auto-Spacing, Explicit Create vs Edit Mode, Preview)  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: MATH ENGINE LAYOUT & RULED BASELINE PRECISION                           │
│          (Implementation & Visual Verification of computeLineUnits & baselineY)  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: END-TO-END INTEGRATION, PERSISTENCE & REGRESSION VERIFICATION           │
│          (IndexedDB/Supabase roundtrip, Legacy Draft Migration, All Tests Green) │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Hybrid Block-Document Core & Backward-Compatible Serialization

### 1.1 Goal
Establish the typed `DocumentBlock` data model and bidirectional HTML serialization/migration layer. This serves as the architectural bedrock, eliminating DOM range ambiguity and establishing stable block boundaries.

### 1.2 Exact Files & Modules Affected
- `src/types/document.ts` *(new)*
- `src/lib/editor/blockSerialization.ts` *(new)*
- `src/hooks/useDocumentBlocks.ts` *(new)*
- `tests/test-block-serialization.ts` *(new)*
- `tests/test-document-blocks-hook.ts` *(new)*

### 1.3 Expected Changes
1. **Define Schema (`src/types/document.ts`):**
   ```typescript
   export type BlockType = 'text' | 'math' | 'table' | 'graph';
   export interface BaseBlock { id: string; type: BlockType; createdAt: number; }
   export interface TextBlock extends BaseBlock { type: 'text'; html: string; }
   export interface MathBlock extends BaseBlock {
     type: 'math';
     naturalExpr: string;
     latex: string;
     displayMode: 'block' | 'compact';
   }
   export interface TableBlock extends BaseBlock { type: 'table'; tableData: TableModel; }
   export interface GraphBlock extends BaseBlock { type: 'graph'; graphDef: GraphDefinition; }
   export type DocumentBlock = TextBlock | MathBlock | TableBlock | GraphBlock;
   ```
2. **Implement `htmlToBlocks(html: string): DocumentBlock[]` (`blockSerialization.ts`):**
   - Parses existing HTML strings from IndexedDB and Supabase.
   - Extracts `<div class="math-block" data-latex="...">` $\to$ `MathBlock`.
   - Extracts `<table class="handtext-table" ...>` $\to$ `TableBlock`.
   - Extracts `<div class="graph-block" data-graph-def="...">` $\to$ `GraphBlock`.
   - Groups intermediate HTML nodes into `TextBlock` instances with stable UUIDs.
   - Idempotent and tolerant of missing attributes.
3. **Implement `blocksToHtml(blocks: DocumentBlock[]): string` (`blockSerialization.ts`):**
   - Serializes block sequence back into clean semantic HTML with `data-block-id` and `data-block-type`.
4. **Implement `useDocumentBlocks` State Hook (`useDocumentBlocks.ts`):**
   - Pure state machine for: `insertBlock(type, data, afterId?)`, `updateBlock(id, data)`, `deleteBlock(id)`, `moveBlock(id, dir)`, `splitTextBlock(id, offset)`.
   - Selection state: `selectedBlockId`, `activeEditingBlockId`.
   - Built-in undo/redo history stack for block operations.

### 1.4 Dependencies
- None. Relies only on existing TypeScript definitions (`TableModel`, `GraphDefinition`).

### 1.5 Invariants
- `htmlToBlocks(blocksToHtml(blocks))` must produce an identical block sequence (round-trip idempotency).
- Legacy HTML containing unadorned math, table, or graph tags must load without missing nodes.
- No changes to `src/lib/handwriting/` or Canvas rendering in this phase.

### 1.6 Automated Tests
- `tests/test-block-serialization.ts`:
  - Round-trip serialization for mixed documents (Text $\to$ Math $\to$ Text $\to$ Table $\to$ Graph).
  - Legacy HTML fixture migration (asserting UUID generation and correct block typing).
- `tests/test-document-blocks-hook.ts`:
  - Verify `insertBlock` after a specific block ID.
  - Verify `deleteBlock` removes only target ID and restores selection.
  - Verify undo/redo stack correctness.

### 1.7 Browser / UAT Checks
- None in this phase (pure logic / data layer).

### 1.8 Acceptance Criteria
- [ ] Round-trip serialization produces 100% fidelity.
- [ ] Unit tests pass with `npx tsx tests/test-block-serialization.ts`.
- [ ] No regression in existing test files.

### 1.9 Rollback / Regression Considerations
- New isolated files; zero impact on running application until integrated in Phase 2.

---

## Phase 2: Editor UI Overhaul — Block Views, Discrete Object Selection & Natural Text Continuation

### 2.1 Goal
Replace the monolithic `contenteditable` container with a clean, block-oriented workspace. Provide PowerPoint/Figma-style discrete object selection for math/table/graph blocks, isolate rich text editing to individual text blocks, and automatically focus a subsequent text block when math is inserted.

### 2.2 Exact Files & Modules Affected
- `src/components/editor/BlockListContainer.tsx` *(new)*
- `src/components/editor/TextBlockView.tsx` *(new)*
- `src/components/editor/MathBlockView.tsx` *(new)*
- `src/components/editor/TableBlockView.tsx` *(new)*
- `src/components/editor/GraphBlockView.tsx` *(new)*
- `src/components/editor/RichContentEditor.tsx` *(refactor to host BlockListContainer)*
- `tests/test-block-editor-interactions.ts` *(new)*

### 2.3 Expected Changes
1. **`TextBlockView.tsx`:**
   - Isolated `contenteditable="true"` div bound exclusively to that text block's `html`.
   - `onKeyDown`:
     - `Enter` at end of block creates a new `TextBlock` below.
     - `Backspace` on empty block deletes it and moves focus to preceding block.
     - `ArrowDown` at end of block moves selection to subsequent block.
2. **`MathBlockView.tsx`:**
   - Discrete object rendering (NOT inside a text contenteditable).
   - Visual states: Default, Hover (subtle border), Selected (blue ring `ring-2 ring-indigo-500` + floating action chips `[ Edit (Enter) ] [ Delete (Backspace) ]`).
   - Single-click selects the object without triggering browser caret collapse.
   - Double-click or clicking "Edit" triggers `editBlock(block.id)`.
   - `Delete` or `Backspace` deletes the block cleanly.
3. **`TableBlockView.tsx` & `GraphBlockView.tsx`:**
   - Wraps existing `TableEditor` and `Graph` components.
   - Preserves all row/column resizing, compact row heights, cell alignments, and graph previews.
4. **`BlockListContainer.tsx`:**
   - Renders the ordered list of blocks.
   - Clicking empty editor padding maps to the nearest block boundary and focuses a `TextBlock`.
5. **Auto-Continuity on Insertion:**
   - When a `MathBlock` is inserted, the container checks if the following block is a `TextBlock`. If not, it automatically creates one and programmatically focuses it.

### 2.4 Dependencies
- Depends on Phase 1 (`src/types/document.ts`, `useDocumentBlocks`).

### 2.5 Invariants
- Do NOT turn the editor into a freeform canvas. Blocks flow strictly in vertical reading order.
- Existing table editing operations (`insertTableRow`, `insertTableColumn`, alignment) must function identically.
- Existing graph controls must function identically.

### 2.6 Automated Tests
- `tests/test-block-editor-interactions.ts`:
  - Test block insertion ordering.
  - Test deleting a selected MathBlock leaves adjacent TextBlocks intact.
  - Test splitting a TextBlock upon object insertion.

### 2.7 Browser / UAT Checks
- Click on MathBlock: Blue focus ring appears; cursor does NOT get trapped inside widget.
- Press `Backspace` on selected MathBlock: Block disappears cleanly; focus returns to preceding text.
- Click "Insert Math": Block inserted $\to$ focus immediately appears in new line below $\to$ user types without mouse clicks.

### 2.8 Acceptance Criteria
- [ ] Non-text blocks have clear, visible selection outlines.
- [ ] Caret is never lost after interacting with an object.
- [ ] Table editing features continue working normally inside `TableBlockView`.

### 2.9 Rollback / Regression Considerations
- `RichContentEditor.tsx` keeps a fallback compatibility flag during development so legacy rendering can be toggled if an edge case arises.

---

## Phase 3: Smart Natural Math Parser & Modal Interaction

### 3.1 Goal
Empower users to enter mathematical content intuitively without learning LaTeX syntax or typing `\quad` for spacing. Separate toolbar "Insert Math" (`create` mode) from "Edit Math" (`edit(blockId)` mode) to eliminate the formula overwriting bug permanently.

### 3.2 Exact Files & Modules Affected
- `src/lib/math/naturalParser.ts` *(new)*
- `src/components/editor/MathFormulaModal.tsx` *(refactor)*
- `src/components/editor/EditorToolbar.tsx` *(refactor)*
- `tests/test-natural-math-parser.ts` *(new)*
- `tests/test-math-modal-lifecycle.ts` *(new)*

### 3.3 Expected Changes
1. **Implement `parseNaturalMath(input: string): string` (`src/lib/math/naturalParser.ts`):**
   - **Subscripts:** `Z1` $\to$ `Z_{1}`, `X2` $\to$ `X_{2}`, `W11` $\to$ `W_{11}`.
   - **Natural Fractions:** `a/b` $\to$ `\frac{a}{b}`, `(x + 1)/(y - 1)` $\to$ `\frac{x + 1}{y - 1}`.
   - **Exponents & Roots:** `x^2` $\to$ `x^{2}`, `sqrt(x)` $\to$ `\sqrt{x}`.
   - **Natural Spacing:** Preserves whitespace between independent variables/terms (`\,`), and inserts `\quad` after commas in multi-equation assignments (`W11 = -1, W12 = 2`).
   - **Symbol Shorthand:** `alpha` $\to$ `\alpha`, `<=` $\to$ `\le`, `>=` $\to$ `\ge`, `!=` $\to$ `\neq`.
   - **Raw LaTeX Passthrough:** If string contains `\`, `\begin`, `\int`, `\sum`, passes through verbatim for advanced power users.
2. **Modal Architecture Refactor (`MathFormulaModal.tsx`):**
   - Props interface:
     ```typescript
     interface MathFormulaModalProps {
       isOpen: boolean;
       mode: 'create' | 'edit';
       targetBlockId?: string;
       initialExpression?: string;
       onInsert: (naturalExpr: string, latex: string) => void;
       onClose: () => void;
     }
     ```
   - In `create` mode: Input is strictly blank; target is new block insertion.
   - In `edit` mode: Input is initialized strictly to `targetBlock.naturalExpr`.
   - Real-time preview renders handwriting/KaTeX as the user types.
   - Clickable symbol palette chips ($\pm, \times, \div, \le, \ge, \neq, \sqrt{\phantom{x}}, \frac{a}{b}, \alpha, \beta, \pi$).
   - "Advanced LaTeX" toggle switch for power users.
   - `Ctrl + Enter` commits and closes; `Esc` cancels.
3. **`EditorToolbar.tsx` Update:**
   - Clicking "Math" button triggers `openCreateMathModal()` anchored at current block.
   - Clears any previous `formatState.mathInfo` references.

### 3.4 Dependencies
- Depends on Phase 1 and Phase 2.

### 3.5 Invariants
- Raw LaTeX expressions written by advanced users must not be corrupted by natural parser.
- Modal must never hold stale references from previously edited formulas.

### 3.6 Automated Tests
- `tests/test-natural-math-parser.ts`:
  - `Z1 = X1 W11 + X2 W21` produces valid LaTeX with subscripts and spacing.
  - `x^2`, `x_1`, `sqrt(x)`, `a/b` produce correct LaTeX equivalents.
  - `W11 = -1, W12 = 2, W21 = 1` contains horizontal `\quad` separation.
  - Raw LaTeX (`\int_0^\infty e^{-x} dx`) passes through untouched.
- `tests/test-math-modal-lifecycle.ts`:
  - Opening modal in `create` mode after editing an existing block produces empty input.

### 3.7 Browser / UAT Checks
- Open editor $\to$ Insert `Z1 = X1 W11 + X2 W21` $\to$ Formula renders cleanly with spaces.
- Click elsewhere $\to$ Click "Math" toolbar button $\to$ Modal opens with EMPTY input (no old formula).
- Insert second formula `x^2 = 4` $\to$ Both formulas exist independently. Neither is overwritten.

### 3.8 Acceptance Criteria
- [ ] Natural math notation converts accurately.
- [ ] No `\quad` needed for horizontal spacing in natural formulas.
- [ ] Formula overwriting bug is completely eliminated.

### 3.9 Rollback / Regression Considerations
- Natural parser functions as an idempotent string transformation; if any unexpected syntax occurs, raw LaTeX mode remains available as fallback.

---

## Phase 4: Math Engine Layout & Ruled Baseline Precision (Implementation & Visual Verification)

### 4.1 Goal
Execute and visually verify the proposed mathematical fixes for vertical whitespace inflation and baseline misalignment identified in research. Ensure standard expressions ($x^2 = 4$, $Z_1 = X_1$) stay on 1 lineUnit ($28\text{px}$) and sit directly on the notebook ruled line.

### 4.2 Exact Files & Modules Affected
- `src/lib/math/layout.ts`
- `src/lib/handwriting/renderer.ts`
- `tests/test-math-layout-lineunits.ts` *(new)*
- `tests/test-math-baseline-alignment.ts` *(new)*

### 4.3 Expected Changes
1. **`src/lib/math/layout.ts` (`computeLineUnits`):**
   - Change threshold:
     ```typescript
     // Current over-sensitive threshold:
     // if (totalHeight <= rulingSpacing * 1.05) return 1;
     
     // Corrected threshold:
     if (totalHeight <= rulingSpacing * 1.35) {
       return 1;
     }
     return Math.max(1, Math.ceil(totalHeight / (rulingSpacing * 1.15)));
     ```
   - Allows compact formulas with superscripts ($x^2$), subscripts ($x_1$), or single fractions to occupy 1 lineUnit without vertical gaps.
2. **`src/lib/handwriting/renderer.ts` (Baseline Anchor):**
   - Line ~419:
     ```typescript
     // Remove artificial lift:
     // if (box.descent > rulingSpacing * 0.12) { baselineY = ruledLineY - box.descent; }
     
     // Corrected: Anchor math baseline strictly to notebook ruled line:
     const baselineY = ruledLineY;
     box.draw(ctx, originX, baselineY, pen);
     ```
   - Descenders naturally draw below the line, exactly like handwritten letters $g, y, p$.
3. **Fraction & Delimiter Metrics (`layout.ts`):**
   - Fraction bar vertical padding set to compact $3\text{px}$ gap.
   - Delimiters scale proportionally to inner box height without excessive padding.

### 4.4 Dependencies
- Depends on Phase 1 (for math AST boxes).

### 4.5 Invariants
- Multi-line matrices, tall summations, and large integrals must still allocate 2+ lineUnits when their height demands it.
- Pen ink variation, stroke width, and organic wobble must remain untouched.

### 4.6 Automated Tests
- `tests/test-math-layout-lineunits.ts`:
  - Assert `computeLineUnits` returns 1 for $x^2 = 4$ at ruling spacing 28.
  - Assert `computeLineUnits` returns 1 for $Z_1 = X_1 W_{11}$ at ruling spacing 28.
  - Assert `computeLineUnits` returns $\ge 2$ for tall matrix or large summation.
- `tests/test-math-baseline-alignment.ts`:
  - Assert `baselineY` equals `ruledLineY` for expressions with descenders ($y = mx + b$, $x_1$).

### 4.7 Browser / Visual Verification Checks
- Visual inspection on ruled paper canvas:
  - Text sentence ending with a colon $\to$ Math formula on next line $\to$ Math baseline rests squarely on the ruled line.
  - Formula containing $x^2$ does NOT create a 2-line blank gap.
  - Fractions look compact and legible.

### 4.8 Acceptance Criteria
- [ ] $x^2$ occupies 1 lineUnit ($28\text{px}$).
- [ ] Math baseline rests directly on the ruled notebook line.
- [ ] Visual verification confirms natural notebook appearance.

### 4.9 Rollback / Regression Considerations
- Modifications are confined to numerical constants in `layout.ts` and line 419 of `renderer.ts`; readily tunable if specific glyph edge cases emerge.

---

## Phase 5: End-to-End Integration, Persistence & Regression Verification

### 5.1 Goal
Connect the redesigned block editor to IndexedDB draft storage, Supabase project synchronization, and the A4 handwriting layout/rendering pipeline. Verify zero regression across all existing tests and features.

### 5.2 Exact Files & Modules Affected
- `src/components/editor/EditorWorkspace.tsx`
- `src/hooks/useProjectPersistence.ts`
- `src/lib/handwriting/parse.ts`
- `tests/test-editor-persistence-e2e.ts` *(new)*

### 5.3 Expected Changes
1. **Persistence Integration (`EditorWorkspace.tsx` & `useProjectPersistence.ts`):**
   - Document changes debounce-save (500ms) via `blocksToHtml` into IndexedDB and Supabase.
   - On document load, drafts and projects deserialize via `htmlToBlocks`.
2. **Handwriting Pipeline Integration (`parse.ts`):**
   - `parse.ts` converts the block sequence into `FlowItem[]` for A4 layout.
   - Ruled-line layout and pagination accurately position each block across pages.
3. **Full Regression Execution:**
   - Execute all test suites across the repository:
     - `test-graph-core.ts`
     - `test-graph-layout.ts`
     - `test-table-operations.test.ts`
     - `test-table-cell-height.ts`
     - `test-math-parser.ts`
     - `test-block-serialization.ts`
     - `test-natural-math-parser.ts`
     - `test-math-layout-lineunits.ts`

### 5.4 Dependencies
- Depends on Phases 1, 2, 3, and 4.

### 5.5 Invariants
- 100% backward compatibility: existing saved projects and drafts load without data loss.
- Table operations, compact row heights, and repeated headers must remain functional.
- Graph rendering and plotting must remain functional.
- Canvas export to PNG/PDF must produce high-resolution handwritten pages.

### 5.6 Automated Tests
- `tests/test-editor-persistence-e2e.ts`:
  - Full lifecycle test: Load legacy draft HTML $\to$ verify converted blocks $\to$ add MathBlock $\to$ add TableBlock $\to$ serialize to HTML $\to$ reload $\to$ assert identity.
- Full test runner script running all 15+ test suites.

### 5.7 Browser / UAT Verification Checks
- Create a complete student assignment:
  1. Header: "Assignment 1: Neural Networks" (TextBlock)
  2. Text: "Given the first node equations:" (TextBlock)
  3. Math: `Z1 = X1 W11 + X2 W21` (MathBlock via natural input)
  4. Text: "We compile the weight matrix:" (TextBlock, auto-focused without clicking)
  5. Table: 3x3 weight table (TableBlock)
  6. Math: `W11 = -1, W12 = 2` (MathBlock via natural input)
  7. Graph: Activation function plot $y = 1/(1 + \exp(-x))$ (GraphBlock)
- Verify that live Canvas preview renders authentic A4 pages with ruled lines.
- Reload page $\to$ verify draft is restored completely from IndexedDB.

### 5.8 Acceptance Criteria
- [ ] All 5 block types (Text, Math, Table, Graph) operate harmoniously.
- [ ] Legacy drafts load with zero data loss.
- [ ] All test suites pass green.

### 5.9 Rollback / Regression Considerations
- The HTML serialization layer acts as a safety buffer: persisted data format remains standard HTML, so rolling back any UI component leaves stored user data completely intact.

---

## 3. Acceptance Criteria Checklist

- [ ] **Architectural Foundation:** Block Document Core established first; no isolated patch cycle.
- [ ] **No Overwriting:** Inserting a new formula never modifies or overwrites any existing formula.
- [ ] **No Caret Loss:** Editor caret is never trapped or lost after opening/closing the Math modal.
- [ ] **Unbroken Continuity:** Inserting a formula places the cursor immediately into a new text block below the formula.
- [ ] **Natural Math:** Expressions like `Z1 = X1 W11 + X2 W21`, `x^2`, `a/b`, `sqrt(x)` parse and render without typing `\quad` or raw LaTeX.
- [ ] **Power-User LaTeX:** Raw LaTeX remains supported via toggle or backslash passthrough.
- [ ] **Vertical Spacing Correction:** $x^2$ occupies 1 lineUnit ($28\text{px}$) instead of 2 lines.
- [ ] **Ruled Baseline Alignment:** Math baseline sits directly on the notebook ruled line; descenders extend below without lifting.
- [ ] **Discrete Object Interaction:** Single click selects Math/Table/Graph with a visible outline; `Delete`/`Backspace` cleanly deletes the selected object.
- [ ] **Table Preservation:** Existing tables retain compact rows, column resizing, alignment, and multi-page header repetition.
- [ ] **Graph Preservation:** Existing graphs retain axes, plotting, and handwritten styling.
- [ ] **Backward Compatibility:** All existing saved documents and drafts load without data loss.
- [ ] **Clean Test Suite:** All existing and new automated tests pass green.
