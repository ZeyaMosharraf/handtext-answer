# HandText Editor: Comprehensive Document Consistency Audit Report

**Date**: 2026-09-20  
**Phase**: Phase 0 — Investigation & Root Cause Analysis Only (No Product Code Modified)  
**Target Repository**: `handtext-answer`  
**Audit Scope**: Complete pipeline audit (`Left Digital Editor State ↔ Document / Block Model ↔ Parser / Serialization ↔ Layout Engine ↔ Handwritten Renderer ↔ Right A4 Output`)

---

## Executive Summary

A systematic consistency audit of the HandText editor was conducted to uncover why digital content in the left editor fails to render faithfully on the right handwritten page (as exemplified by the formula `x' = x - min / max - min` where only `x` was rendered).

The investigation revealed that **the core issue is not a visual rendering bug**, but an **architectural breakdown across serialization, regular expression parsing, and dual incompatible block models**:

1. **The Primary Screenshot Bug**: A brittle regular expression pattern `/data-latex=["']([^"']*)["']/i` used across the codebase truncates any LaTeX formula containing a single quote `'` (prime notation `x'`, derivatives `f'(x)`, second derivatives `y''`, or English text `\text{it's}`). The parser extracts only the substring before the first `'`, discarding the entire formula payload.
2. **Data Destruction in Table Serialization**: In `blocksToHtml` (`parse.ts`), table cells are serialized via string interpolation of a raw JavaScript object (`<${tag}>${cell}</${tag}>`), turning all table cells into `[object Object]` upon serialization or migration.
3. **Silent Deletion of Nested Blocks**: If a MathBlock or GraphBlock is inserted or pasted inside a `<p>` tag in `contentEditable`, the HTML tokenizer fails to match the inner token and **silently deletes the block from the document**.
4. **Catastrophic "Write on Page" Loss**: Typing a single character in the "Write on page" overlay runs `plainTextToHtml`, which **destroys all MathBlocks, GraphBlocks, Tables, and formatting** in the entire document.
5. **The Dual Architecture Schism**: The codebase contains an orphaned typed block model (`types/document.ts`, `useDocumentBlocks.ts`, `BlockListContainer.tsx`) that is completely unused in production. Instead, `EditorWorkspace.tsx` relies on a monolithic `contentEditable` HTML string and brittle regexes.

---

## 1. Metrics & Severity Breakdown

### Total Bugs Discovered: **14**

| Severity | Count | Product Impact |
|---|:---:|---|
| **P0** | **4** | Permanent data corruption, silent block deletion, catastrophic document loss |
| **P1** | **5** | Major document representation mismatch, crash, geometry clipping, architectural divergence |
| **P2** | **4** | Important UX/functional inconsistencies (caret loss, undo state desync, tokenization spacing) |
| **P3** | **1** | Performance / render lifecycle overhead (redundant layout and math parsing on keystroke) |

---

## 2. Root Cause Grouping

```
ROOT CAUSE A: Negated Character Class Attribute Regex Antipattern (["']([^"']*)["'])
├── Causes BUG-CONSISTENCY-001 (Math formula truncated at single quote: x' -> x)
└── Causes BUG-CONSISTENCY-005 (Graph/JSON definition truncation when attributes contain quotes)

ROOT CAUSE B: Missing Object Serialization Boundary in Table Export
├── Causes BUG-CONSISTENCY-002 (Table cells serialized to [object Object] in blocksToHtml)
└── Causes BUG-CONSISTENCY-013 (Table cell formatting lost on markdown export)

ROOT CAUSE C: Flat Tag Assumption Over Monolithic ContentEditable DOM
├── Causes BUG-CONSISTENCY-003 (Silent deletion of Math/Graph blocks nested inside <p>)
└── Causes BUG-CONSISTENCY-010 (Caret destruction and cursor jump on value sync)

ROOT CAUSE D: Destructive Plain Text Conversion in Write-on-Page Overlay
└── Causes BUG-CONSISTENCY-004 (Typing in write-on-page wipes all math, graphs, tables)

ROOT CAUSE E: Independent Coordinate & Geometry Definitions (Editor vs Canvas)
├── Causes BUG-CONSISTENCY-007 (Table top border at lineIndex: 0 invades header band)
├── Causes BUG-CONSISTENCY-008 (Graph block topY at lineIndex: 0 invades header band)
└── Causes BUG-CONSISTENCY-009 (Hardcoded 100px canvas margin vs 72px editor margin)

ROOT CAUSE F: Orphaned Block Model vs Monolithic ContentEditable State
├── Causes BUG-CONSISTENCY-006 (Two disconnected document models in the repository)
├── Causes BUG-CONSISTENCY-011 (Window-level undo desynchronizes React state from DOM)
└── Causes BUG-CONSISTENCY-014 (Entire document parsed and laid out on every keystroke)
```

---

## 3. Bug Inventory

### [BUG-CONSISTENCY-001]
- **Category**: Parser / Serialization
- **Severity**: P0
- **Reproduction**: Insert math formula `x' = x - min / max - min`. Observe right handwritten output.
- **Expected**: Formula `x' = x - min / max - min` is parsed and rendered completely.
- **Actual**: Parser captures only `"x"`. Canvas draws only the letter `x`. Everything after `'` is dropped.
- **Affected Files**: `src/lib/handwriting/parse.ts` (lines 480, 546, 711, 729, 748, 1246), `src/lib/editor/blockSerialization.ts` (lines 341, 441).
- **Root Cause**: Regular expression `data-latex=["']([^"']*)["']` uses negated character class `[^"']*`, which halts at `'`. The closing delimiter `["']` immediately matches `'`, truncating the value.
- **Fix**: Use quote-matching regex `data-latex=(["'])([\s\S]*?)\1` or dedicated DOM attribute reading.
- **Test**: `tests/test-math-quote-consistency.test.ts`.

---

### [BUG-CONSISTENCY-002]
- **Category**: Serialization / Data Corruption
- **Severity**: P0
- **Reproduction**: Call `blocksToHtml(parseContent("<table><tr><td>Data</td></tr></table>"))`.
- **Expected**: `<td>Data</td>`.
- **Actual**: `<td>[object Object]</td>`.
- **Affected Files**: `src/lib/handwriting/parse.ts` (line 1155).
- **Root Cause**: `cell` is a `TableCellData` object `{ text, segs }`. Line 1155 interpolates `${cell}` into an HTML template string without accessing `.text` or `.segs`.
- **Fix**: Use `segsToHtml(cell.segs)` or `escapeHtml(cell.text)`.
- **Test**: `tests/test-table-serialization.test.ts`.

---

### [BUG-CONSISTENCY-003]
- **Category**: Parser / Block Model
- **Severity**: P0
- **Reproduction**: Paste or insert a MathBlock or GraphBlock while cursor is inside text (`<p>Before <div class="math-block" data-latex="y=x"></div> After</p>`).
- **Expected**: Parses into paragraph, math block, and trailing paragraph.
- **Actual**: The pre-pass generates `<p><p data-math-token="..."></p></p>`. The non-greedy `blockRegex` truncates at the first `</p>`. The math token regex fails to match, and the block is deleted.
- **Affected Files**: `src/lib/handwriting/parse.ts` (lines 477-525, 725-765), `src/components/editor/RichContentEditor.tsx` (lines 1130-1140).
- **Root Cause**: ContentEditable allows `<div>` inside `<p>`. `parseContent` assumes flat non-nested block tags.
- **Fix**: Add block-unwrapping pre-pass in `parse.ts` to hoist block elements out of `<p>` before tokenizing.
- **Test**: `tests/test-nested-block-recovery.test.ts`.

---

### [BUG-CONSISTENCY-004]
- **Category**: Document Pipeline / Data Loss
- **Severity**: P0
- **Reproduction**: In a document containing MathBlocks or Tables, enable "Write on page" and type any character.
- **Expected**: The typed character is added without modifying or deleting math/tables.
- **Actual**: `plainTextToHtml` converts the entire text string into `<p>` elements, permanently wiping all MathBlocks, GraphBlocks, Tables, and formatting.
- **Affected Files**: `src/components/editor/EditorWorkspace.tsx` (lines 734-741), `src/lib/handwriting/parse.ts` (lines 1260-1279).
- **Root Cause**: `plainTextToHtml` is a destructive lossy serializer that treats all content as plain paragraphs.
- **Fix**: Implement block-preserving AST update for on-page text editing.
- **Test**: `tests/test-write-on-page-safety.test.ts`.

---

### [BUG-CONSISTENCY-005]
- **Category**: Block Model / Serialization
- **Severity**: P1
- **Reproduction**: Call `blocksToHtml` with a `GraphBlock`.
- **Expected**: Graph block serializes with `data-graph-definition`.
- **Actual**: Crashes with `TypeError: Cannot read properties of undefined (reading 'title')`.
- **Affected Files**: `src/lib/editor/blockSerialization.ts` (line 144).
- **Root Cause**: `blockSerialization.ts` accesses `block.graphDef.title`, but `GraphBlock` definition in `src/types/document.ts` was renamed or diverged from `parse.ts`.
- **Fix**: Normalize `GraphBlock` property contract across `types/document.ts` and `blockSerialization.ts`.
- **Test**: `tests/test-graph-core.ts`.

---

### [BUG-CONSISTENCY-006]
- **Category**: Architecture
- **Severity**: P1
- **Reproduction**: Inspect `src/components/editor/BlockListContainer.tsx` vs `EditorWorkspace.tsx`.
- **Expected**: A unified block architecture managing document state.
- **Actual**: `BlockListContainer` and `useDocumentBlocks` are completely orphaned; `EditorWorkspace` uses an ad-hoc monolithic HTML string.
- **Affected Files**: `src/components/editor/EditorWorkspace.tsx`, `src/components/editor/BlockListContainer.tsx`.
- **Root Cause**: Incomplete architectural migration leaving two divergent paradigms.
- **Fix**: Align the document state contract so `RichContentEditor` or `BlockListContainer` operates on a shared, validated block AST.

---

### [BUG-CONSISTENCY-007]
- **Category**: Layout / Geometry
- **Severity**: P1
- **Reproduction**: Place a table at the very top of a page (or repeat header on page 2).
- **Expected**: Top border aligns below the header band.
- **Actual**: `getBaseline(coordinates, -1)` produces a Y coordinate above `firstBaselineY`, cutting into the page header band.
- **Affected Files**: `src/lib/handwriting/renderer.ts` (line 470), `src/lib/handwriting/layout.ts` (line 789).
- **Root Cause**: `drawTableRow` assumes every table has an available ruling line at `lineIndex - 1`.
- **Fix**: Clamp `top` to `coordinates.contentTop` or allocate a gap line when `lineIndex === 0`.
- **Test**: `tests/test-table-cell-height.ts`.

---

### [BUG-CONSISTENCY-008]
- **Category**: Layout / Geometry
- **Severity**: P1
- **Reproduction**: Place a graph block at `lineIndex: 0`.
- **Expected**: Graph box top aligns below the header band.
- **Actual**: `topY = ruledLineY - rulingSpacing` pushes the graph one full line above `firstBaselineY`, overlapping the header.
- **Affected Files**: `src/lib/handwriting/renderer.ts` (line 454).
- **Root Cause**: `drawGraphBlock` unconditionally subtracts `rulingSpacing` from `firstBaselineY`.
- **Fix**: Clamp `topY` to `coordinates.contentTop` when `lineIndex === 0`.
- **Test**: `tests/test-graph-layout.ts`.

---

### [BUG-CONSISTENCY-009]
- **Category**: Editor ↔ Canvas Consistency
- **Severity**: P1
- **Reproduction**: Compare left editor Answer Margin gutter with right canvas vertical margin line.
- **Expected**: Both agree on margin position (e.g. 72px or user-configured width).
- **Actual**: Left editor uses `72px`; canvas hardcodes `100px`. Changing width in settings is ignored by canvas.
- **Affected Files**: `src/lib/handwriting/layout.ts` (line 400), `src/components/editor/RichContentEditor.tsx` (line 269).
- **Root Cause**: `layout.ts` uses hardcoded literal `100` instead of `settings.page.answerMargin.width`.
- **Fix**: Bind `marginRuleX` dynamically to `settings.page.answerMargin?.width ?? 72`.
- **Test**: `tests/test-answer-margin-phase2.ts`.

---

### [BUG-CONSISTENCY-010]
- **Category**: Editor UX / Caret Stability
- **Severity**: P2
- **Reproduction**: Type rapidly in `RichContentEditor`.
- **Expected**: Cursor stays at the typing position.
- **Actual**: When external props update `value`, minor HTML formatting discrepancies trigger `el.innerHTML = normalized`, destroying DOM nodes and resetting cursor to position 0.
- **Affected Files**: `src/components/editor/RichContentEditor.tsx` (lines 683-698).
- **Root Cause**: Primitive string comparison between live DOM `innerHTML` and re-sanitized `normalized` HTML.
- **Fix**: Preserve DOM structure during typing; only update DOM when content truly diverges externally.

---

### [BUG-CONSISTENCY-011]
- **Category**: State / History
- **Severity**: P2
- **Reproduction**: Press Ctrl+Z while typing in the editor.
- **Expected**: Smooth word-by-word undo preserving cursor location.
- **Actual**: Window keydown intercepts Ctrl+Z, restores coarse 500ms snapshot, overwrites `innerHTML`, and drops cursor focus.
- **Affected Files**: `src/components/editor/EditorWorkspace.tsx` (lines 259-272).
- **Root Cause**: Global window listener overrides native browser undo inside contentEditable.
- **Fix**: Defer to native contentEditable undo while focused inside the editor, or restore selection along with snapshot.

---

### [BUG-CONSISTENCY-012]
- **Category**: Math Parser
- **Severity**: P2
- **Reproduction**: Type `min` or `max` in formula without backslash (`x - min / max - min`).
- **Expected**: Formatted as function identifier with standard roman/italic spacing.
- **Actual**: Emitted as separate single-letter identifiers `m`, `i`, `n`, causing italic kerning gaps between letters.
- **Affected Files**: `src/lib/math/tokens.ts` (lines 196-201).
- **Root Cause**: `tokenize()` assumes any alphabetical run is single-character `IDENT` tokens unless preceded by `\`.
- **Fix**: Recognize common multi-letter math identifiers/functions (`min`, `max`, `sin`, `cos`, `log`, `ln`).
- **Test**: `tests/test-math-parser.ts`.

---

### [BUG-CONSISTENCY-013]
- **Category**: Tables / Serialization
- **Severity**: P2
- **Reproduction**: Export table to markdown via `tableToMarkdown`.
- **Expected**: Retains cell formatting.
- **Actual**: All bold, italic, color, and scale styling in cells is stripped to plain text.
- **Affected Files**: `src/lib/handwriting/parse.ts` (lines 1220-1238).
- **Root Cause**: `tableToMarkdown` calls `getTableCellText(c)` instead of retaining markdown formatting markers.
- **Fix**: Preserve inline markdown delimiters when exporting cells to markdown.

---

### [BUG-CONSISTENCY-014]
- **Category**: Performance / Lifecycle
- **Severity**: P3
- **Reproduction**: Type in a multi-page document with multiple math blocks.
- **Expected**: Incremental layout of modified blocks.
- **Actual**: Every keystroke re-runs full HTML tokenization, re-parses all math ASTs, and re-renders entire canvas.
- **Affected Files**: `src/components/editor/EditorWorkspace.tsx` (lines 356-397).
- **Root Cause**: Zero memoization of parsed math boxes or layout flow items.
- **Fix**: Memoize `parseMath()` and `layoutMath()` by LaTeX string and scale.

---

## 4. Architectural Synthesis & Recommendations

### Is the current block architecture sound?
**No.** The project currently suffers from an unresolved duality: an orphaned structured block model (`DocumentBlock[]` in `types/document.ts`) exists alongside a production monolithic HTML contentEditable DOM (`RichContentEditor.tsx`). The handwritten layout engine relies on regular expressions to extract blocks from HTML, which creates fragile boundaries where nested tags and quote characters cause silent data loss.

### Is Math integrated correctly with the document pipeline?
**Partially.** 
- The mathematical layout engine (`layoutMath`) and pen stroke renderer (`drawMathBlock`) are robust and produce high-quality output when given clean ASTs.
- However, **math integration into the document pipeline is flawed**:
  1. The HTML regex parser truncates formulas at single quotes (`x'`).
  2. Math blocks inserted inside paragraph containers are deleted by the tokenizer.
  3. "Write on page" strips math formulas into plain text.

### Do the left editor and right renderer truly have a single source of truth?
**No.**
- The left editor's source of truth is the **mutable browser DOM tree** inside `RichContentEditor.tsx`.
- The right renderer's source of truth is an **ephemeral AST** created by parsing serialized `innerHTML` via regexes.
- Discrepancies exist in attribute escaping, margin width (72px vs 100px), table cell serialization, and write-on-page handling.

---

## 5. Recommended Execution Roadmap

1. **Phase 1 (Immediate P0 Fixes)**: Correct attribute extraction regexes (`data-latex`) across `parse.ts` and `blockSerialization.ts`; fix table cell `[object Object]` serialization in `blocksToHtml`.
2. **Phase 2 (Parser Robustness)**: Add paragraph unnesting to `parse.ts` so MathBlocks/GraphBlocks inside `<p>` are hoisted rather than deleted.
3. **Phase 3 (Layout Alignment)**: Synchronize Answer Margin width between editor and canvas; fix `lineIndex: 0` negative coordinate calculations for tables and graphs.
4. **Phase 4 (Pipeline Safety)**: Fix write-on-page to prevent catastrophic document loss; unify the `GraphBlock` property contract.
5. **Phase 5 (Performance & Caret UX)**: Add AST memoization for repetitive formulas; stabilize selection during contentEditable updates.
