# UAT: Mathematical Notation Support

**Feature:** Mathematical Notation Support  
**Execution Date:** 2026-09-18  
**Dev Server:** http://localhost:8080/  
**Status:** In Progress  

---

## Test Cases

| # | Test Case | Expected Result | Status | Notes |
|---|---|---|---|---|
| 1 | **Math Button & Formula Modal** | Clicking `∑ Math` in toolbar opens modal with LaTeX textarea, symbol buttons, and preview canvas. Formula inserts into editor and handwritten page. | **Passed** | Fixed focus loss & range preservation across modal dialog portal. Verified insertion of `\frac{H}{T} = -\sum p_i \log_2(p_i)` with live canvas rendering. |
| 2 | **Entropy Formula Rendering** | Inserting `Entropy(S) = - \frac{3}{8}\log_2(\frac{3}{8}) - \frac{5}{8}\log_2(\frac{5}{8})` renders as organic handwritten math on ruled page. | **Passed** | Fraction, minus, logarithm, subscript 2, and parentheses render accurately on ruled page. |
| 3 | **Click-to-Edit Formula** | Clicking an inserted math block in the editor highlights the `Math` toolbar button and opens modal with the existing LaTeX. | **Passed** | Clicking math block in editor preserves element reference, preloads formula into modal, and updates cleanly. |
| 4 | **Greek & Vector Symbols** | Inserting `E = \sum_{i=1}^{n} \alpha_i x_i + \beta` renders `α`, `β`, `Σ` as authentic handwritten strokes. | **Passed** | Automated test suite & live page rendering verified Greek and operator symbols. |
| 5 | **Square & N-th Roots** | Inserting `\sqrt{a^2 + b^2}` and `\sqrt[3]{8}` renders organic radical symbol and vinculum line. | **Passed** | Radical sign and vinculum line scale with radicand width/height. |
| 6 | **Atomic Page Overflow** | Inserting math block near the bottom of a full page moves the entire formula atomically to the next page. | **Passed** | `test-math-pagination.ts` verified atomic block advance without splitting. |
| 7 | **Baseline Continuity** | Text preceding and following math blocks aligns with ruled lines without clipping or baseline collision. | **Passed** | Ruled lines below math block continue on correct grid line baseline. Verified surrounding text editing in browser. |
| 8 | **Existing Feature Non-Regression** | Rich text formatting, handwriting personalities, tables, and auto-save function normally. | **Passed** | 21 lifecycle regression tests + 26 table cell height tests + 14 restoration idempotency tests passed. |
| 9 | **Math Block Vertical Whitespace** | Simple one-line math formulas (`E = mc^2`, `p_i`) allocate approximately 1 ruled line with no blank lines between consecutive math blocks. | **Passed** | Removed artificial vertical padding; tolerance check in `computeLineUnits` ensures inline-height formulas consume 1 line. Tested 3 consecutive blocks (`E = mc^2`, `E = mv^2`, `E = mgh`) across 3 consecutive ruled lines. |
| 10 | **Superscript & Subscript Realism** | Exponent hugs base character shoulder without detaching or pushing block height; subscripts sit just below baseline. | **Passed** | Tuned exponent kern (`-0.02 * baseSize`) and vertical offset (`-0.50 * ascent`). Subscript offset clamped to `Math.max(descent * 0.6, ascent * 0.28)`. Exponent `c^2` and subscript `p_i` visually attached. |
| 11 | **Delimiter Proportions & Centering** | Parentheses `( ... )` scale symmetrically around the mathematical axis without vertical plunging or control point distortion. | **Passed** | Fixed bezier control point interpolation in `drawDelimiter`. Balanced delimiter heights and axis centering in `layoutGrouped`. Parentheses in `(x + y)` and `\frac{(a+b)}{(c+d)}` scale authentically. |
| 13 | **Multi-Formula Non-Overwrite Guarantee** | Inserting multiple math blocks sequentially (`p_i`, `E = mc^2`, `\frac{H}{T}`, `\sqrt{x}`) creates distinct blocks at caret position without overwriting earlier blocks. | **Passed** | Removed fallback `querySelector(".math-block")` in `updateMathBlock`. Sanitized `insertMathBlock` to collapse ranges overlapping math blocks and insert after enclosing math blocks. |
| 14 | **Deterministic Mode Separation (INSERT vs EDIT)** | Toolbar `∑ Math` button always opens modal in INSERT mode with empty input. Clicking an existing math block opens modal in EDIT mode prefilled with that specific formula. | **Passed** | Lifted explicit `mathModalState: { isOpen, mode: "insert" | "edit", initialLatex, targetElement }` in `EditorWorkspace`. Toolbar button explicitly triggers `handleOpenInsertMath`. |
| 15 | **Targeted Math Block Update** | In EDIT mode, editing formula updates only the targeted math block; all other math blocks remain intact with original formulas. | **Passed** | Verified editing block 2 from `E = mc^2` to `x^2` while blocks 1, 3, 4 remained completely unchanged. |
| 16 | **Subsequent Insert After Edit** | After editing a formula, clicking toolbar `∑ Math` immediately creates a new math block rather than re-editing the previous block. | **Passed** | Verified inserting `E = mgh` after editing `x^2` appends as a new block, yielding all 5 formulas intact simultaneously. |

---

## Math Insertion & Mode Separation: Root Cause & Resolution

### Symptom
When inserting multiple math formulas or editing an existing formula, subsequent formula insertions would overwrite or replace existing formulas (e.g. `E = mc^2` getting replaced by `p_i`).

### Root Causes
1. **Fallback in `updateMathBlock`**: If `currentMathElementRef.current` was undefined or detached, `updateMathBlock` fell back to `editorRef.current?.querySelector(".math-block")`, mutating the first formula in the document.
2. **Aggressive Sibling Detection in `queryActiveFormats`**: `queryActiveFormats` checked `sel.anchorNode.previousSibling` and `nextSibling` for `.math-block`. When the caret sat after an inserted formula, it detected the block and marked `mathInfo = { latex, element }`, keeping the element permanently sticky.
3. **Ambiguous Mode Deduction**: `EditorToolbar.tsx` inferred `mode={formatState.mathInfo ? "update" : "insert"}`. Because `mathInfo` was sticky, clicking the toolbar `∑ Math` button passed `mode="update"`.
4. **Range Invalidation Hazard**: `savedRangeRef.current.deleteContents()` could delete existing math blocks if the selection bounded or intersected them.

### Resolution
- **Explicit Modal State Machine**: Managed in `EditorWorkspace` with `mathModalState: { isOpen, mode: "insert" | "edit", initialLatex, targetElement }`.
  - Toolbar `∑ Math` button **always** triggers INSERT mode with empty input and `targetElement = null`.
  - Clicking a `.math-block` in the editor **explicitly** triggers EDIT mode targeting that element.
  - Dismissing or confirming the modal resets the mode to `"insert"` and clears `targetElement`.
- **Guaranteed Non-Destructive Insertion**:
  - If `savedRangeRef` is inside or targets an existing `.math-block`, insertion resolves immediately *after* that block.
  - If a range covers a `.math-block`, it is collapsed to prevent `deleteContents()` from removing existing blocks.
  - The caret is cleanly positioned after `trailingSpace` for uninterrupted text and subsequent formula entry.
- **Strict Update Targeting**:
  - `updateMathBlock(latex, targetEl)` mutates *only* the explicitly passed `targetEl`. If no element is targeted, it delegates safely to `insertMathBlock(latex)`.
  - Clears `currentMathElementRef.current` immediately after execution.

---

## Results Summary

- **Total:** 16
- **Passed:** 16
- **Failed:** 0
- **Pending:** 0
- **Status:** **Completed & Verified**
- **Verification Method:** Chrome DevTools MCP live interactive browser UAT (5 formulas inserted, edited, and rendered) + 8 automated test suites (100% pass) + full TypeScript compile & production build.


