# Mathematical Notation System — Implementation Plan

> **Phased Implementation Plan for Handwritten Mathematical Notation**
> *Status:* Approved — Ready for Execution
> *Architecture Reference:* [MATH_NOTATION_ARCHITECTURE.md](./MATH_NOTATION_ARCHITECTURE.md)
> *ADR Reference:* [ADR-008](./decisions/ADR-008-math-notation-architecture.md)
> *Last Updated:* September 2026

---

## Scope

Implement a complete handwritten mathematical notation system for HandText Answer, allowing users to write and render mathematical expressions as authentic handwritten mathematics on ruled A4 pages.

### In Scope

- Hybrid LaTeX input model (direct LaTeX + symbol palette + live preview)
- Complete `src/lib/math/` module (tokenizer, parser, 2D layout engine, vector glyph paths)
- Extension of `parse.ts`, `layout.ts`, `renderer.ts` to support math blocks and inline math
- Formula insertion modal (`MathFormulaModal.tsx`)
- `EditorToolbar.tsx` Math button
- Comprehensive automated test suite
- Browser E2E verification

### Out of Scope

- Question Panel / synchronized left-right workspace (explicitly deferred)
- `pen.ts` modifications (must remain unchanged)
- Supabase, authentication, or database changes
- Modifications to existing table, heading, list, or paragraph rendering

---

## Architectural Constraints

> These constraints must be enforced throughout all implementation phases.

1. **`pen.ts` is immutable.** It must remain a pure handwriting/glyph/ink simulation engine with no knowledge of math ASTs, MathNode types, or mathematical structures.

2. **`src/lib/math/` owns all math concerns.** No math parsing, layout, or glyph logic in `parse.ts`, `layout.ts`, `renderer.ts`, or `RichContentEditor.tsx`.

3. **`layout.ts` treats math as atomic flow items.** A `FlowMathBlock` has a pre-computed `lineUnits` and is never split across pages.

4. **`renderer.ts` is a thin bridge.** It calls `layoutMath()` from `src/lib/math/` and dispatches `MathLayoutBox.draw()`. All actual canvas operations go through `pen.ts` primitives.

5. **Final output is handwritten Canvas rendering.** No SVG, no KaTeX, no MathJax, no digital math screenshots.

---

## Phase 1: Math AST, Tokenizer & Parser

**Goal:** Build the foundational math input pipeline — tokenize LaTeX and produce a well-typed AST.

### Files Created

- `src/lib/math/types.ts` — All math node interfaces and the `MathNode` union type
- `src/lib/math/tokens.ts` — LaTeX tokenizer: `tokenize(latex: string): Token[]`
- `src/lib/math/parser.ts` — Recursive-descent parser: `parseMath(latex: string): MathNode[]`
- `src/lib/math/index.ts` — Public API re-exports

### Deliverables

- [x] `MathNode` union type (`NumberNode`, `IdentifierNode`, `OperatorNode`, `SymbolNode`, `FractionNode`, `SupSubNode`, `RootNode`, `FunctionNode`, `GroupedNode`, `BigOpNode`, `SpaceNode`)
- [x] `MathLayoutBox` interface stub in `types.ts`
- [x] Tokenizer supporting all LaTeX commands listed in architecture doc §6.2
- [x] Recursive-descent parser handling: fractions, roots, superscripts, subscripts, functions, big operators, grouped delimiters, Greek commands, relational symbols
- [x] Error resilience: unknown commands → IdentifierNode, unclosed braces → consume remaining tokens

### Test File

`tests/test-math-parser.ts`

### Required Passing Tests

```
PASS: Parse plain number: "3" → NumberNode
PASS: Parse identifier: "x" → IdentifierNode
PASS: Parse \frac{a}{b} → FractionNode
PASS: Parse nested \frac{\frac{1}{2}}{3}
PASS: Parse x^2 → SupSubNode (sup)
PASS: Parse x_1 → SupSubNode (sub)
PASS: Parse x_1^2 → SupSubNode (both)
PASS: Parse \sqrt{x} → RootNode
PASS: Parse \sqrt[3]{8} → RootNode with index
PASS: Parse \sqrt{a^2 + b^2}
PASS: Parse \log_2(x) → FunctionNode with SupSubNode
PASS: Parse \alpha, \beta, \theta, \Sigma → SymbolNode
PASS: Parse \leq, \geq, \neq, \approx, \infty → SymbolNode
PASS: Parse \sum_{i=0}^{n} → BigOpNode
PASS: Parse \int_a^b → BigOpNode
PASS: Parse full entropy formula
PASS: Resilient parse of unknown \unknown{x}
PASS: Resilient parse of unclosed \frac{a
```

### Verification

```bash
npx tsx tests/test-math-parser.ts
npx tsc --noEmit
```

---

## Phase 2: 2D Math Layout Engine & Ruled Grid Integration

**Goal:** Compute bounding box dimensions (width, ascent, descent) for every AST node and integrate math blocks with the existing ruled-line coordinate system.

### Files Created/Modified

- `src/lib/math/layout.ts` — Full `MathLayoutBox` computation for all `MathNode` types
- `src/lib/math/index.ts` — Export `layoutMath(ast: MathNode[], ctx, settings, scale): MathLayoutBox`
- `src/lib/handwriting/parse.ts` — Extend `BlockKind` with `"math"`, add `MathBlockData`, detect `math-block` divs and `math-inline` spans
- `src/lib/handwriting/layout.ts` — Add `FlowMathBlock`, integrate into `buildFlow()`, `paginate()`

### Deliverables

- [x] `MathLayoutBox` with `width`, `ascent`, `descent`, `draw()`, and optional `children` for debugging
- [x] Layout functions for each node type:
  - `layoutNumber()`, `layoutIdentifier()`, `layoutOperator()`, `layoutSymbol()`
  - `layoutFraction()` — fraction bar at math axis, children at 0.80× scale
  - `layoutSupSub()` — superscript at −0.45em, subscript at +0.22em, scripts at 0.70× scale
  - `layoutRoot()` — radical symbol geometry, vinculum bar, optional nth-root index at 0.55× scale
  - `layoutFunction()` — upright (non-italic) function name with subscript support
  - `layoutGroup()` — stretchy delimiters sized to enclosed content height
  - `layoutBigOp()` — large Σ/∫ symbol with lower/upper limits at 0.70× scale
- [x] Scale clamping: minimum `0.60 ×` base font size for deep nesting
- [x] `lineUnits = max(1, ceil((ascent + descent + 2×padding) / rulingSpacing))`
- [x] Math axis integration: primary baseline locks to a ruled writing line
- [x] `parse.ts` emits `Block { kind: "math", math: { latex, display } }` for display math
- [x] `layout.ts` `FlowMathBlock` with pre-computed `lineUnits`
- [x] `paginate()` handles `FlowMathBlock` atomically (never splits)

### Test File

`tests/test-math-layout.ts`

### Required Passing Tests

```
PASS: Simple identifier has positive width, ascent, descent
PASS: Fraction ascent > single identifier ascent
PASS: Fraction width ≥ max(numerator.width, denominator.width)
PASS: Superscript increases box ascent above base
PASS: Subscript increases box descent below base
PASS: Root box width > radicand width
PASS: lineUnits = ceil(totalHeight / rulingSpacing)
PASS: lineUnits ≥ 1 always
PASS: Nested fraction scale ≤ 0.80 × parent scale
PASS: Scale clamping: never below 0.60 × base
PASS: Math block is atomic — moves to next page if overflow
PASS: Text after math block continues on correct baseline
PASS: Gap lines before math block handled correctly
```

### Verification

```bash
npx tsx tests/test-math-layout.ts
npx tsc --noEmit
```

---

## Phase 3: Handwriting Canvas Rendering

**Goal:** Draw fully handwritten math on canvas using `pen.ts` primitives through `renderer.ts`, including Greek/special symbol vector glyphs.

### Files Created/Modified

- `src/lib/math/glyphs.ts` — Handwritten vector stroke paths for Greek letters and special math symbols
- `src/lib/handwriting/renderer.ts` — Add `drawMathBlock()`, call `layoutMath()`, dispatch `mathBox.draw()`

### Deliverables

- [x] `GlyphDrawFn` type in `glyphs.ts`
- [x] Vector glyph path implementations for Priority-High symbols:
  - `α` (alpha), `β` (beta), `θ` (theta), `λ` (lambda), `π` (pi)
  - `Σ` (Sigma/summation), `∫` (integral)
  - `∞` (infinity), `√` (radical standalone)
  - `≤`, `≥`, `≠`, `≈` (relational operators)
- [x] Vector glyph stubs (or font-fallback with jitter) for Priority-Medium symbols:
  - `μ`, `σ`, `ω`, `Δ`, `Ω`, `∂`, `±`
- [x] Fallback strategy in `glyphs.ts`: font render + PRNG rotation/jitter for unmapped symbols
- [x] `layoutSymbol()` in `math/layout.ts` dispatches to `glyphs.ts` glyph functions
- [x] `renderer.ts`: `drawMathBlock(placement, ctx, settings, coordinates, random, ink)` computes `baselineY` from placement, calls `mathBox.draw()`
- [x] Inside `MathLayoutBox.draw()`:
  - Glyph/variable/number rendering: `writeSegments(ctx, seg, settings, x, y, random, pen)` via `pen.ts`
  - Fraction bar, vinculum, structural lines: `inkLine(ctx, ...)` via `pen.ts`
  - Radical symbol, stretchy brackets: `ctx.bezierCurveTo(...)` with jitter from `random()`
- [x] All math rendering passes `pen.ts` jitter parameters (slant, rotation, baseline jitter)

### Verification

```bash
npx tsc --noEmit
npm run build
# Manual browser inspection: insert entropy formula, check handwritten output
```

### Browser Spot Checks

- Fraction numerator/denominator positioned correctly relative to ruled line
- Superscripts positioned above baseline without overlapping ruling above
- Root vinculum rendered as an organic hand-drawn line
- Greek symbols (`α`, `θ`, `Σ`) appear in handwriting style, not system sans-serif
- Ink color, pen width, and slant match the active handwriting personality

---

## Phase 4: Editor UX — Formula Modal & Toolbar

**Goal:** Deliver the complete user-facing math insertion experience.

### Files Created/Modified

- `src/components/editor/MathFormulaModal.tsx` — [NEW] Formula editor popover
- `src/components/editor/EditorToolbar.tsx` — [EXTEND] Add Math button
- `src/components/editor/RichContentEditor.tsx` — [EXTEND] Handle math-block DOM nodes

### Deliverables

**`MathFormulaModal.tsx`:**
- [x] LaTeX textarea input with monospace font
- [x] Quick-insert symbol/structure buttons:
  - Structures: `[a/b]`, `[x²]`, `[x₁]`, `[√x]`, `[ⁿ√x]`
  - Greek: `[α]`, `[β]`, `[θ]`, `[λ]`, `[π]`, `[∞]`
  - Operators: `[±]`, `[≤]`, `[≥]`, `[≠]`, `[≈]`, `[Σ]`, `[∫]`
- [x] Live canvas preview (dedicated mini-canvas, 100ms debounced re-render on LaTeX change)
- [x] "Insert Formula" button: injects/updates `<div class="math-block" data-latex="...">` in editor
- [x] "Cancel" button: dismisses without modification
- [x] `onMouseDown={e => e.preventDefault()}` on all buttons to preserve editor selection

**`EditorToolbar.tsx`:**
- [x] Add Math icon button (`√x` / `Σ`)
- [x] Button highlights when cursor is inside a math-block node (contextual state)
- [x] Clicking button while cursor in math-block: opens modal pre-populated with existing LaTeX
- [x] Clicking button while cursor not in math-block: opens modal with empty input

**`RichContentEditor.tsx`:**
- [x] `insertMathBlock(latex: string): void` method on `RichContentEditorHandle`
- [x] `updateMathBlock(latex: string): void` method on `RichContentEditorHandle`
- [x] `getMathInfo(): { latex: string } | null` method on `RichContentEditorHandle`
- [x] Cursor detection: `FormatState.mathInfo?: { latex: string }` updated in `updateFormatState()`
- [x] `handleKeyDown`: `Delete`/`Backspace` on selected math-block removes it cleanly

### Verification

```bash
npx tsc --noEmit
# Browser: open editor, click Math button, insert formula, verify output
```

---

## Phase 5: Comprehensive Automated & Browser Verification

**Goal:** Full test suite execution, build verification, and browser E2E confirmation.

### Test Files

- `tests/test-math-parser.ts` — Phase 1 parser tests (≥17 tests)
- `tests/test-math-layout.ts` — Phase 2 layout tests (≥13 tests)
- `tests/test-math-pagination.ts` — Phase 2 pagination tests (≥5 tests)

### Required Verification Commands

```bash
npx tsx tests/test-math-parser.ts          # All parser tests pass
npx tsx tests/test-math-layout.ts          # All layout tests pass
npx tsx tests/test-math-pagination.ts      # All pagination tests pass
npx tsx tests/test-table-cell-height.ts    # Existing tests still pass (no regression)
npx tsx tests/test-table-operations.test.ts # Existing tests still pass
npx tsx tests/test-restoration-idempotency.ts # Existing tests still pass
npx tsc --noEmit                           # Zero TypeScript errors
npm run build                              # Production build succeeds
```

### Browser E2E Test Cases

1. Insert entropy formula: `\text{Entropy}(S) = -\frac{3}{8}\log_2\!\left(\frac{3}{8}\right) - \frac{5}{8}\log_2\!\left(\frac{5}{8}\right)`
   - Verify: handwritten fraction, subscript, minus signs — no digital SVG artifacts.
2. Insert formula, then click it — verify modal opens pre-populated with existing LaTeX.
3. Insert paragraph before and after math block — verify ruled baseline alignment.
4. Insert 40+ lines of text + math block near page bottom — verify math moves atomically to page 2.
5. Insert formula with Greek: `E = \sum_{i=1}^{n} \alpha_i x_i + \beta`
   - Verify: `α`, `β`, `Σ` appear handwritten, not system-font.
6. Insert formula with root: `\sqrt{a^2 + b^2}`
   - Verify: radical vinculum is organic hand-drawn line, not geometric.
7. Verify existing tables, headings, bullets, and paragraphs are completely unaffected.
8. Export to PDF — verify math renders at high resolution with handwritten quality.

---

## Files Created Summary

| File | Status | Phase |
|---|---|---|
| `src/lib/math/types.ts` | NEW | 1 |
| `src/lib/math/tokens.ts` | NEW | 1 |
| `src/lib/math/parser.ts` | NEW | 1 |
| `src/lib/math/index.ts` | NEW | 1 |
| `src/lib/math/layout.ts` | NEW | 2 |
| `src/lib/math/glyphs.ts` | NEW | 3 |
| `src/lib/handwriting/parse.ts` | EXTEND | 2 |
| `src/lib/handwriting/layout.ts` | EXTEND | 2 |
| `src/lib/handwriting/renderer.ts` | EXTEND | 3 |
| `src/lib/handwriting/pen.ts` | **UNCHANGED** | — |
| `src/components/editor/MathFormulaModal.tsx` | NEW | 4 |
| `src/components/editor/EditorToolbar.tsx` | EXTEND | 4 |
| `src/components/editor/RichContentEditor.tsx` | EXTEND | 4 |
| `tests/test-math-parser.ts` | NEW | 1 |
| `tests/test-math-layout.ts` | NEW | 2 |
| `tests/test-math-pagination.ts` | NEW | 2 |

---

## Backward Compatibility Guarantee

- All existing projects (plain text, tables, headings, bullets) must render **exactly as before**.
- `pen.ts` is not modified.
- Existing `Seg` fields are additive-only: `mathAst?` is optional.
- `BlockKind` union is extended with `"math"` (additive — no existing block types changed).
- Parser falls back cleanly for any content not matching math block patterns.
- `npx tsx tests/test-table-cell-height.ts` and `test-restoration-idempotency.ts` must remain 100% green after every phase.
