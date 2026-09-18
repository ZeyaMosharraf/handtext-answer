# Root Cause & Architecture Investigation: MathBlock Visual Object Rendering vs. Raw LaTeX

**Date:** 2026-09-18  
**Phase:** Math & Document Editor — MathBlock Visual Object UX Investigation  
**Status:** Root Cause Identified — No Code Modified Yet

---

## Executive Summary

Visual inspection of the editor workspace in the browser revealed that Math blocks in the document editor currently render raw LaTeX / source strings (e.g. `\frac{H}{T}`, `\sqrt{x}`, `X^{2}`, `\sqrt[n]{x}`, `\alpha + \beta`, `E = mc^2`) inside a monospace text chip instead of rendering the formatted mathematical expression.

This violates the core product requirement:
- **A MathBlock must be a first-class visual document object** (like an embedded formula object in Notion or PowerPoint), presenting formatted mathematics (fractions with horizontal division bars, roots with radical symbols, superscripts, subscripts, etc.).
- **The user must NOT have to read or write raw LaTeX** as the primary visual representation.
- **Raw source input belongs exclusively to the Edit state**, while the resting visual object in the document must display the composed equation.

---

## 1. Current MathBlock Rendering Path

In the current codebase:
1. When a math block is inserted or loaded from HTML, `useDocumentBlocks` stores it as a `MathBlock` with `latex: "\\frac{H}{T}"`, `naturalExpr: "\\frac{H}{T}"`, `displayMode: "block"`.
2. `BlockListContainer.tsx` renders `<MathBlockView block={block} ... />`.
3. Inside `MathBlockView.tsx` (lines 56–99):
   ```tsx
   const displayFormula = block.naturalExpr || block.latex || "Formula";
   const truncatedFormula =
     displayFormula.length > 70 ? `${displayFormula.slice(0, 67)}…` : displayFormula;

   return (
     <div className="math-block-view ...">
       <div className="flex items-center gap-2.5 overflow-hidden">
         <span className="..."><Sigma className="size-3.5" /></span>
         <span className="font-mono text-xs font-semibold text-foreground truncate">
           {truncatedFormula}
         </span>
       </div>
       {/* Action Chips */}
     </div>
   );
   ```
4. The literal string `\frac{H}{T}` is placed directly into a `<span>` with `font-mono text-xs`.
5. No parsing, no 2D layout, and no canvas drawing is invoked within `MathBlockView`.

---

## 2. Exact Root Cause

During Phase 2, the primary focus was on establishing the *two-tier discrete object interaction model* (stable block IDs, selection outlines, double-click to edit, Backspace/Delete to remove, action chips for `[Edit]` and `[Delete]`).

To satisfy the component scaffolding, `MathBlockView` was given a placeholder text chip showing `truncatedFormula` in monospace font. The component was never wired to the existing Math layout/canvas pipeline in `src/lib/math/`. Consequently, what should have been a temporary scaffolding representation persisted as the visual rendering.

---

## 3. Existing Reusable Math Rendering Capabilities

HandText **already possesses** a complete, custom, high-fidelity 2D handwritten Math layout and rendering engine. No external libraries (such as KaTeX or MathJax) are needed or permitted.

The engine consists of:
1. **`src/lib/math/parser.ts` (`parseMath`):**
   - Recursive descent parser that compiles math strings into a typed `MathNode[]` AST:
     - `FractionNode` (`\frac{num}{den}`)
     - `RootNode` (`\sqrt{x}`, `\sqrt[n]{x}`)
     - `SupSubNode` (`base^sup_sub`)
     - `BigOpNode` (`\sum`, `\int`, `\prod` with upper and lower limits)
     - `SymbolNode` (Greek letters α, β, θ, etc.)
     - `FunctionNode` (`\sin`, `\cos`, `\log`, etc.)
     - `GroupedNode` (parentheses, brackets, absolute value)
2. **`src/lib/math/layout.ts` (`layoutMath`):**
   - Pure 2D math layout engine converting `MathNode[]` into a `MathLayoutBox` tree.
   - Computes exact bounding box metrics: `width`, `ascent` (height above baseline), and `descent` (depth below baseline).
   - Handles font scale inheritance (fractions 0.72×, scripts 0.65×, roots 0.55×).
3. **`src/lib/math/glyphs.ts` & `src/lib/handwriting/pen.ts` (`box.draw`):**
   - Renders the layout box to any HTML5 `CanvasRenderingContext2D`.
   - Draws fraction bars with `inkLine`.
   - Draws radical symbols and vinculum lines.
   - Draws Greek and mathematical symbols via vector stroke paths matching the user's selected handwriting font.
4. **`src/components/editor/MathFormulaModal.tsx`:**
   - Already demonstrates this exact rendering pattern (lines 158–189):
     ```ts
     const ast = parseMath(trimmed);
     const box = layoutMath(ast, ctx, settings, 1.0);
     box.draw(ctx, originX, baselineY, settings, previewRng, inkColor);
     ```
5. **`src/lib/handwriting/renderer.ts`:**
   - Already uses this exact same pipeline to draw math on the final A4 page canvas.

---

## 4. Answers to Critical Investigation Questions

### 1. Is MathBlockView intentionally displaying `naturalExpr` or `latex` as plain text?
No. It was a temporary placeholder chip implemented during Phase 2 scaffolding to establish block selection and deletion semantics.

### 2. Is the existing Math AST/layout engine already capable of rendering the expression?
Yes. `parseMath` + `layoutMath` already handles fractions, radicals, exponents, subscripts, big operators, Greek letters, and functions.

### 3. Is there an existing preview renderer that should be reused?
Yes. `MathFormulaModal.tsx` has a proven, battle-tested preview implementation using a canvas and `box.draw`.

### 4. Where should MathBlockView obtain its visual representation from?
`MathBlockView` should render an embedded `<canvas>` sized to `box.width` × `(box.ascent + box.descent)` using `parseMath` and `layoutMath` from `@/lib/math`.

### 5. Should the editor preview use the same Math layout engine as the final Canvas renderer?
**YES.** Using the exact same `layoutMath` engine guarantees 100% visual parity between the in-editor document and the handwritten page preview, without duplicating logic or introducing third-party renderers.

### 6. How should editing/source mode be separated from visual object mode?
- **Visual Object Mode:** The resting state in the document. Shows only the formatted mathematical equation. Single click selects the object (drawing the outline ring and showing `[Edit]` and `[Delete]` action chips).
- **Editing Mode:** Opened via double-click, Enter on selection, or clicking `[Edit]`. Opens the `MathFormulaModal` where the user edits the formula with live visual preview.

### 7. How should natural input eventually feed the same pipeline?
In Phase 3, the Natural Math Parser will convert natural notation (e.g. `Z1 = X1 W11 + X2 W21`, `a/b`, `sqrt(x)`) into the canonical `MathNode[]` AST / LaTeX. Because `MathBlockView` renders from that same AST/LaTeX via `layoutMath`, natural input will flow directly into the exact same visual layout without altering `MathBlockView`.

### 8. How can we avoid duplicating Math parsing/layout logic?
By keeping `src/lib/math` as the single shared engine. Both `MathBlockView`, `MathFormulaModal`, and `renderer.ts` import `parseMath` and `layoutMath` from `@/lib/math`.

### 9. How can the MathBlock remain lightweight and performant?
- The canvas is sized tightly to the bounding box of the equation (`box.width` × `(box.ascent + box.descent)`), multiplied by `devicePixelRatio` for retina clarity.
- Layout box calculation is memoized using React's `useMemo` based on `[block.latex, block.naturalExpr, settings]`.
- Re-rendering occurs only when the formula or settings change; typing in adjacent text blocks produces zero re-renders of the canvas.

### 10. How does this interact with the Phase 4 ruled-grid/baseline work?
`MathLayoutBox` computes explicit `ascent` and `descent` relative to `baselineY`. In Phase 4, these exact metrics will be used to align equations with lined notebook rulings. In `MathBlockView`, using the same baseline calculation ensures identical visual proportions.

---

## 5. Correct Visual Object Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ MathBlockView (Discrete Document Object)                    │
│                                                             │
│   ┌───────────────────────────────────────────────────────┐ │
│   │  [Embedded Canvas — Rendered Equation]                │ │
│   │                                                       │ │
│   │         H                                             │ │
│   │         ─                                             │ │
│   │         T                                             │ │
│   │                                       [Edit] [Delete] │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                             │
│ - Single Click: Selects object (shows focus ring + chips)   │
│ - Double Click / Enter: Opens formula editor modal          │
│ - Backspace / Delete: Deletes block atomically              │
└─────────────────────────────────────────────────────────────┘
```

1. **Rendering Mechanism:**
   - Inside `MathBlockView.tsx`, replace the `<span className="font-mono">{truncatedFormula}</span>` with a `<canvas ref={canvasRef} />`.
   - On mount / formula change:
     1. Parse formula: `const ast = parseMath(formula);`
     2. Layout formula: `const box = layoutMath(ast, tempCtx, settings, 1.0);`
     3. Size canvas: `width = box.width`, `height = box.ascent + box.descent + padding`.
     4. Draw formula: `box.draw(ctx, paddingX, box.ascent + paddingTop, settings, rng, inkColor);`
2. **Fallback Safety:**
   - If formula is empty or has a syntax error during parsing/layout, gracefully render a clean fallback badge or readable text with an error indicator without crashing the editor.
3. **Display Modes:**
   - `block` displayMode: equation is horizontally centered or padded in its container.
   - `compact` displayMode: inline-flex, tightly fitted to equation width.

---

## 6. Edit-Mode Architecture

The editing state remains strictly decoupled from document resting state:
- When user wants to edit:
  - Trigger: click `[Edit]`, double-click canvas, or press `Enter` while block is selected.
  - Action: calls `onEdit?.()`, which opens `MathFormulaModal`.
- Inside `MathFormulaModal`:
  - Input field: supports formula input (LaTeX or natural notation).
  - Symbol snippets: quick insertion of fractions, roots, Greek letters, operators.
  - Live Canvas Preview: provides real-time visual feedback as the user types.
- On Confirm:
  - Updates the targeted `MathBlock` in document state.
  - `MathBlockView` automatically re-renders its canvas with the new equation.
  - Document never exposes raw LaTeX in resting state.

---

## 7. Natural-Input Compatibility (Phase 3 Alignment)

When Phase 3 implements the Natural Math Parser:
1. The user will type natural notation:
   `Z1 = X1 W11 + X2 W21` or `a/b` or `sqrt(x)`
2. The parser will produce:
   - `naturalExpr`: `"Z1 = X1 W11 + X2 W21"`
   - `latex`: `"Z_1 = X_1 W_{11} + X_2 W_{21}"`
   - `ast`: `MathNode[]`
3. `MathBlockView` will consume this AST/LaTeX without any structural change, rendering subscripts for `Z_1`, `W_{11}`, etc. immediately.

---

## 8. Minimal Files That Should Change

To implement the visual MathBlock object rendering, ONLY the following file needs to change:
1. `src/components/editor/MathBlockView.tsx`:
   - Replace raw text `<span>` with embedded `<canvas>` rendering pipeline.
   - Add memoized `layoutMath` and `box.draw` invocation.
   - Add error boundary / graceful fallback for invalid formulas.
   - Retain all object selection, double-click to edit, Backspace to delete, and action chips.

*(Optional prop enhancement: pass `settings` from `RichContentEditor` / `EditorWorkspace` to `MathBlockView` so the formula automatically uses the project's chosen handwriting font and ink color; defaults to `DEFAULT_SETTINGS` if omitted).*

---

## 9. Files That Must Remain Untouched

- `src/components/editor/TextBlockView.tsx` (Seamless borderless text editing is verified and solid)
- `src/components/editor/TableBlockView.tsx` & `GraphBlockView.tsx`
- `src/types/document.ts` (Data model already supports `latex`, `naturalExpr`, `displayMode`)
- `src/lib/editor/blockSerialization.ts` (Round-trip HTML serialization verified)
- `src/lib/editor/documentOperations.ts`
- `src/hooks/useDocumentBlocks.ts`
- `src/lib/math/parser.ts` & `src/lib/math/layout.ts` (Existing layout engine is correct and must not be duplicated)
- `src/lib/handwriting/*` (A4 pagination and rendering engine remains untouched)

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Canvas DPI Blurriness** | Multiply canvas dimensions by `window.devicePixelRatio || 1` and apply `ctx.scale(dpr, dpr)` so equations are razor-sharp on high-resolution displays. |
| **Font Loading Timing** | If handwriting font (e.g. Caveat) has not finished loading on initial mount, canvas might measure with fallback font. Mitigate by listening to `document.fonts.ready` or re-measuring on font load. |
| **Invalid LaTeX / Parse Errors** | Wrap `parseMath` and `layoutMath` in `try/catch`. If an error occurs, render a clean fallback with a warning tooltip instead of crashing. |
| **Performance Overhead** | Memoize layout box calculation; only redraw when formula or font settings change. Canvas size is strictly bounded to the equation dimensions. |

---

## 11. Browser Verification Strategy

1. **Visual Equation Inspection:**
   - Verify `\frac{H}{T}` renders visually as a vertical fraction with numerator $H$, horizontal bar, and denominator $T$.
   - Verify `\sqrt{x}` renders with a radical symbol and vinculum bar over $x$.
   - Verify `X^{2}` renders with 2 elevated as a superscript.
   - Verify Greek letters like `\alpha + \beta` render as handwritten Greek glyphs.
2. **Object Selection & Interaction:**
   - Single click selects the visual math canvas (selection ring + `[Edit]` `[Delete]` chips appear).
   - Double-click or Enter opens `MathFormulaModal`.
   - Backspace/Delete removes the block cleanly.
3. **No Raw LaTeX in Document:**
   - Confirm that zero raw LaTeX syntax is visible anywhere on the document canvas in resting state.
