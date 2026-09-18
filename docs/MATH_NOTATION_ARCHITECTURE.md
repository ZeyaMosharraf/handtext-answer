# HandText — Mathematical Notation Architecture

> **Technical Architecture Analysis & Design for Handwritten Mathematical Notation**
> *Target Audience:* Core Engineers, Math Subsystem Contributors, AI Development Workflows
> *Last Updated:* September 2026
> *Document Status:* Architecture Approved — Pending Implementation

---

## 1. Goal & Non-Goals

### Goal

Allow users to write mathematical expressions in answers and render them **as handwritten mathematics** on the final A4 ruled page — preserving the selected handwriting personality, pen stroke physics, and ink aesthetics. Math must coexist cleanly with normal text blocks, headings, lists, tables, and page breaks.

### Non-Goals

- Do NOT stamp digital KaTeX/MathJax SVGs or system serif fonts onto handwritten paper.
- Do NOT make `pen.ts` responsible for parsing or understanding mathematical structures.
- Do NOT implement Math inside `renderer.ts`, `parse.ts`, or `RichContentEditor.tsx` as ad-hoc hacks.
- Do NOT build the Question Panel or synchronized left-right workspace (deferred to a separate phase).

---

## 2. Critical Architectural Invariants

These must be preserved during implementation:

1. **`pen.ts` remains a pure handwriting/glyph/ink simulation engine.** It is unaware of math semantics, AST nodes, or mathematical structures.

2. **The Math Subsystem (`src/lib/math/`) owns all math concerns.** Tokenization, AST generation, 2D box layout calculations, and mathematical stroke definitions are confined to this module.

3. **`layout.ts` treats math as atomic 2D positioned bounding boxes.** It quantizes their height to integer `lineUnits` for pagination, exactly as table rows are treated.

4. **`renderer.ts` bridges the math layout box to canvas rendering.** It calls into `src/lib/math/` to obtain positioned draw commands, then delegates glyph strokes to `pen.ts` primitives.

5. **The final canvas output must look handwritten.** No SVG pasting, no digital-font rasterization.

---

## 3. Math Input Model Evaluation

### 3.1 Alternatives Evaluated

| Model | Description | Strengths | Weaknesses | Decision |
|---|---|---|---|---|
| **A. Pure LaTeX** | User types raw LaTeX like `\frac{3}{8}\log_2` | Universal standard; compact storage; AI-native (ChatGPT, Claude, Gemini all emit LaTeX natively); zero vendor lock-in | Raw syntax intimidating for non-technical students without visual assistance | Adopted as **storage format** |
| **B. MathLive WYSIWYG** | `mathlive` interactive math editor web component | Full visual formula editing | 2.5 MB+ bundle; Shadow DOM conflicts; produces DOM/MathML not our AST; opinionated visual output; heavy mobile overhead | **REJECTED** |
| **C. Plain Unicode** | Type `x² + √y ≤ ∞` directly | Directly typeable by anyone | Cannot represent vertical fractions, radical vinculums, or 2D nested structures | **REJECTED — Inadequate** |
| **D. Hybrid LaTeX + Symbol Helper** | LaTeX storage + compact click-to-insert palette for common structures and symbols | Serves both power users (LaTeX) and casual students (symbol buttons); live handwritten canvas preview before insertion | Requires implementing a lightweight formula modal component | **RECOMMENDED** |

### 3.2 Recommended Model: Hybrid LaTeX

**Storage format:** Standard LaTeX string stored in `data-latex` attribute on a non-editable block in the `contenteditable` editor.

**Input methods:**
1. Direct LaTeX text entry in the formula modal.
2. Quick-insert symbol and structure palette for common constructs.
3. Live canvas preview before insertion.

---

## 4. Math AST (Abstract Syntax Tree)

File: `src/lib/math/types.ts`

Mathematical expressions are hierarchical trees of 2D entities. The AST must represent recursive, nested structures.

```typescript
export type MathNode =
  | NumberNode
  | IdentifierNode
  | OperatorNode
  | SymbolNode
  | FractionNode
  | SupSubNode
  | RootNode
  | FunctionNode
  | GroupedNode
  | BigOpNode
  | SpaceNode;

/** A numeric literal, e.g. "3", "3.14", "8" */
export interface NumberNode {
  type: "number";
  value: string;
}

/** A variable or identifier, e.g. "x", "y", "S" */
export interface IdentifierNode {
  type: "identifier";
  value: string;
}

/** A binary, unary, or relational operator, e.g. "+", "-", "=", "*", "÷", "±" */
export interface OperatorNode {
  type: "operator";
  value: string;
}

/**
 * A mathematical symbol that may not be in the base handwriting font's character set.
 * Greek letters and special operators require vector glyph paths.
 * e.g. "α", "β", "θ", "λ", "π", "Σ", "∫", "∞", "≤", "≥", "≠", "≈"
 */
export interface SymbolNode {
  type: "symbol";
  symbol: string;  // Actual Unicode character
  name: string;    // LaTeX command name: "alpha", "theta", "sum", "int"
}

/** A fraction: \frac{numerator}{denominator} */
export interface FractionNode {
  type: "fraction";
  numerator: MathNode[];
  denominator: MathNode[];
}

/**
 * Superscript and/or subscript on a base expression.
 * e.g. x^2 (sup only), x_1 (sub only), \log_2 (base with sub), x_1^2 (both)
 */
export interface SupSubNode {
  type: "supsub";
  base: MathNode[];
  sup?: MathNode[];
  sub?: MathNode[];
}

/** A square root or n-th root: \sqrt{x}, \sqrt[3]{8} */
export interface RootNode {
  type: "root";
  radicand: MathNode[];
  index?: MathNode[];  // Optional n-th root index
}

/** A named mathematical function: \log, \ln, \sin, \cos, \tan, \lim, \Entropy */
export interface FunctionNode {
  type: "function";
  name: string;
  arg?: MathNode[];
}

/** A delimited group: (expr), [expr], {expr}, |expr| */
export interface GroupedNode {
  type: "grouped";
  open: "(" | "[" | "{" | "|";
  close: ")" | "]" | "}" | "|";
  body: MathNode[];
}

/**
 * Large operators with optional limits: Σ, Π, ∫
 * e.g. \sum_{i=0}^{n}, \int_a^b
 */
export interface BigOpNode {
  type: "bigOp";
  operator: "sum" | "prod" | "integral";
  lower?: MathNode[];
  upper?: MathNode[];
  operand?: MathNode[];
}

/** A whitespace node: \quad, \;, \, — used for operator spacing */
export interface SpaceNode {
  type: "space";
  widthEm: number;
}
```

---

## 5. Math Block & Inline Content Representation

### 5.1 Display Math Blocks (Standalone equations)

In the editor `contenteditable` DOM:
```html
<div
  class="math-block"
  data-latex="\text{Entropy}(S) = -\frac{3}{8}\log_2\!\left(\frac{3}{8}\right) - \frac{5}{8}\log_2\!\left(\frac{5}{8}\right)"
  contenteditable="false"
>
  <span class="math-preview">[Handwritten Preview]</span>
</div>
```

In the parser's `Block[]` model (extension to `parse.ts`):
```typescript
export type BlockKind =
  | "heading" | "subheading" | "bullet" | "numbered"
  | "paragraph" | "quote" | "divider" | "table" | "blank"
  | "math";  // NEW

export interface MathBlockData {
  latex: string;
  ast: MathNode[];
  display: "block";
}

export interface Block {
  kind: BlockKind;
  text: string;
  segs?: Seg[];
  marker?: string;
  table?: TableData;
  math?: MathBlockData;  // NEW: present when kind === "math"
}
```

In legacy markdown (parser recognition):
```
$$
\text{Entropy}(S) = -\frac{3}{8}\log_2\left(\frac{3}{8}\right)
$$
```
Single-line display: `$$ ... $$` on one line.

### 5.2 Inline Math (Variables, subscripts, short inline formulas)

In the editor DOM:
```html
The formula <span class="math-inline" data-latex="x^2 + y^2 = r^2" contenteditable="false">x² + y² = r²</span> describes a circle.
```

Inline math is embedded within a paragraph or heading `Block`. The parser detects `<span class="math-inline" data-latex="...">` and emits a special `Seg` variant:
```typescript
export interface Seg {
  text: string;
  bold: boolean;
  underline: boolean;
  italic?: boolean;
  color?: string;
  scale?: number;
  highlight?: string;
  mathAst?: MathNode[];  // NEW: present for inline math spans
}
```

When `mathAst` is present on a `Seg`, the layout engine delegates horizontal extent measurement to the math layout engine rather than the standard glyph measurer.

---

## 6. Tokenizer & Parser Architecture

File: `src/lib/math/tokens.ts` and `src/lib/math/parser.ts`

A lightweight, deterministic, zero-dependency recursive-descent LaTeX math tokenizer and parser (~12–15 KB of TypeScript).

### 6.1 Token Types

```typescript
export type TokenKind =
  | "COMMAND"    // \frac, \sqrt, \alpha, \log
  | "NUMBER"     // 3, 3.14, 0.5
  | "IDENT"      // x, y, S (single letters by default italic in math)
  | "OPERATOR"   // +, -, =, *, /, <, >, !, ','
  | "LBRACE"     // {
  | "RBRACE"     // }
  | "LBRACKET"   // [
  | "RBRACKET"   // ]
  | "LPAREN"     // (
  | "RPAREN"     // )
  | "SUP"        // ^
  | "SUB"        // _
  | "PIPE"       // |
  | "TEXT"       // literal plain text (inside \text{...})
  | "EOF";

export interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}
```

### 6.2 Supported LaTeX Commands

| Category | Commands |
|---|---|
| **Fractions** | `\frac`, `\dfrac`, `\tfrac` |
| **Roots** | `\sqrt` (with optional `[n]` index) |
| **Delimiters** | `\left(`, `\right)`, `\left[`, `\right]`, `\left\{`, `\right\}`, `\left|`, `\right|` |
| **Functions** | `\log`, `\ln`, `\sin`, `\cos`, `\tan`, `\sec`, `\csc`, `\cot`, `\lim`, `\max`, `\min`, `\text` |
| **Greek (Lowercase)** | `\alpha`, `\beta`, `\gamma`, `\delta`, `\epsilon`, `\theta`, `\lambda`, `\mu`, `\nu`, `\pi`, `\rho`, `\sigma`, `\tau`, `\phi`, `\chi`, `\psi`, `\omega` |
| **Greek (Uppercase)** | `\Gamma`, `\Delta`, `\Sigma`, `\Phi`, `\Psi`, `\Omega`, `\Lambda` |
| **Large Operators** | `\sum`, `\prod`, `\int`, `\oint` |
| **Relations / Special** | `\leq`, `\geq`, `\neq`, `\approx`, `\infty`, `\partial`, `\nabla`, `\cdot`, `\times`, `\div`, `\pm`, `\mp` |
| **Spacing** | `\,`, `\;`, `\:`, `\!`, `\quad`, `\qquad` |
| **Text** | `\text{...}` — renders upright via normal cursive font |

### 6.3 Parsing Algorithm

The parser uses standard recursive-descent with explicit operator precedence:

```
parseMathExpr()
  ├── parseNode()
  │     ├── parseFraction()     → FractionNode
  │     ├── parseSqrt()         → RootNode
  │     ├── parseFunction()     → FunctionNode
  │     ├── parseBigOp()        → BigOpNode
  │     ├── parseGroup()        → GroupedNode
  │     ├── parseSymbol()       → SymbolNode
  │     ├── parseNumber()       → NumberNode
  │     └── parseIdent()        → IdentifierNode
  └── parseSupSub(base)         → SupSubNode (wraps base if ^ or _ follows)
```

**Error Resilience**: Unknown commands fall back to `IdentifierNode` with the literal command string rendered as plain handwritten text. Unclosed braces use all remaining tokens as the group body. Parsing never throws — it always produces a valid, renderable AST.

---

## 7. 2D Math Layout Box Model

File: `src/lib/math/layout.ts`

Every AST node is mapped to a `MathLayoutBox` — a rectangular 2D region with a defined baseline:

```typescript
export interface MathLayoutBox {
  /** Unique node type identifier for debugging */
  type: string;
  /** Horizontal extent */
  width: number;
  /** Ascent: height above the baseline */
  ascent: number;
  /** Descent: depth below the baseline */
  descent: number;
  /**
   * Draw function: renders this box at (originX, baselineY) onto the canvas.
   * Delegates glyph rendering to pen.ts primitives.
   */
  draw: (
    ctx: CanvasRenderingContext2D,
    originX: number,
    baselineY: number,
    settings: HandwritingSettings,
    random: () => number,
    ink: string,
  ) => void;
  /** Child boxes with their relative positions for debugging and hit-testing */
  children?: Array<{ box: MathLayoutBox; dx: number; dy: number }>;
}
```

Total height: `ascent + descent`.

### 7.1 Layout Algorithm

Two-pass recursive computation:

**Pass 1 — Measurement (bottom-up):**
Leaf nodes (`NumberNode`, `IdentifierNode`, `SymbolNode`) measure their width and ascent/descent using `ctx.measureText()` with the active handwriting font at the current scale level.

**Pass 2 — Positioning (top-down):**
Parent nodes assign relative `dx` and `dy` offsets to each child based on alignment rules defined per node type (fraction axis, superscript offset, etc.).

### 7.2 Scale Inheritance

Nesting reduces font scale at each level to prevent visual crowding:

| Context | Scale Factor |
|---|---|
| Main expression | `1.0 × tableScale (or 1.0)` |
| Fraction numerator / denominator | `0.80 × parent` |
| Superscript / subscript | `0.70 × parent` |
| Deeply nested (≥ level 2) | Clamped at minimum `0.60 ×` base font size |

This ensures that even `\frac{\frac{a}{b}}{c}` remains legible without ink blobs.

---

## 8. Ruled A4 Coordinate Integration

This is the most critical correctness requirement: Math must live on the ruled paper grid.

### 8.1 The Math Axis

In standard typesetting, the "math axis" is the vertical center of operators (+, −, =) and fraction bars. It sits approximately `0.28 × baseFontSize` **above** the text baseline. This keeps multi-line math expressions visually balanced around the ruling.

```
Ruling line (k-1)  ─────────────────────────────────────
                       ┌────────────────────────────────┐
                       │  Numerator: 3/8                │  ← above axis
                   ─── │  ─────────────────── (axis)    │  ← on math axis (~0.28×size above baseline)
                       │  Denominator: 8                │  ← below axis
Ruling line (k)    ────┤  = log₂(x)        ─────────────── ← main text baseline
                       └────────────────────────────────┘
Ruling line (k+1)  ─────────────────────────────────────
```

### 8.2 lineUnits Calculation

Each math block is converted to an integer number of ruled lines (`lineUnits`) for placement in the existing flow:

```
totalHeight = mathBox.ascent + mathBox.descent + 2 × mathPadding

lineUnits = max(1, ceil(totalHeight / rulingSpacing))
```

The math block's primary **baseline is locked to one of the ruled writing baselines** (specifically the `firstTextBaseline`). Any ascent (numerator, exponent, root) extends upward between ruled lines; descent (denominator, subscript) extends downward between ruled lines. Surrounding text lines never collide.

### 8.3 FlowMathBlock in layout.ts

```typescript
interface FlowMathBlock {
  type: "mathBlock";
  latex: string;
  ast: MathNode[];
  lineUnits: number;    // Computed integer ruling units
  gapLines: number;
}

type FlowItem = FlowLine | FlowTableRow | FlowMathBlock;
```

---

## 9. Fraction Layout Detail

For `\frac{N}{D}`:

1. Layout N (numerator) and D (denominator) at scale `parentScale × 0.80`.
2. Compute `barWidth = max(N.width, D.width) + 2 × padX`.
3. Horizontally center both N and D within `barWidth`.
4. Vertical placement relative to the parent baseline:
   - `axisY = -0.28 × baseFontSize`  (above baseline)
   - `gapY = 0.12 × baseFontSize`    (clearance between bar and content)
   - `N.baselineY = axisY - gapY - N.descent`
   - `D.baselineY = axisY + gapY + D.ascent`
5. Fraction bar stroke: rendered using `inkLine()` from `pen.ts` with natural organic jitter.
6. Box dimensions:
   - `ascent = -N.baselineY + N.ascent`
   - `descent = D.baselineY + D.descent`
   - `width = barWidth`

---

## 10. Superscript & Subscript Layout Detail

For `B^{sup}_{sub}`:

1. Layout base B at `parentScale`.
2. Layout sup and sub at script scale `parentScale × 0.70`.
3. Horizontal position: `xScript = B.width + kernSpacing`
4. Vertical positions:
   - `supBaselineY = -(0.45 × baseFontSize)`  (above parent baseline)
   - `subBaselineY = +(0.22 × baseFontSize)`  (below parent baseline)
5. Box dimensions:
   - `ascent = max(B.ascent, -supBaselineY + sup.ascent)` if sup present
   - `descent = max(B.descent, subBaselineY + sub.descent)` if sub present
   - `width = B.width + kernSpacing + max(supWidth, subWidth)`

---

## 11. Root Layout Detail (`\sqrt{x}`, `\sqrt[n]{x}`)

For `\sqrt[index]{radicand}`:

1. Measure the radicand box at `parentScale`.
2. Add radical padding: `innerWidth = radicand.width + padX`, `innerHeight = radicand.ascent + radicand.descent + padTop + padBottom`.
3. The radical symbol path (all drawn with `inkLine`):
   - **a.** Short upward entry tick (from bottom-left, angled up-right).
   - **b.** Steep plunge down to the bottom vertex of the radical check mark.
   - **c.** Steep ascent up to the vinculum height.
   - **d.** Horizontal vinculum (overline) across the full radicand width + right padding.
4. If an `index` node exists: render it at `parentScale × 0.55` nestled in the top-left crook of the radical symbol.
5. Box dimensions:
   - `ascent = radicand.ascent + radicalTopPad`
   - `descent = radicand.descent + radicalBottomPad`
   - `width = radicalSymbolWidth + radicand.width + rightPad`

---

## 12. Operators & Standard Functions

### 12.1 Binary & Relational Operators (`+`, `−`, `=`, `×`, `÷`, `±`, `≤`, `≥`, `≠`, `≈`)

- Rendered with mathematical whitespace: `0.22 × em` on left and right sides.
- Aligned vertically with the math axis.
- Rendered via `writeSegments()` in `pen.ts` (uses the normal handwriting font, since all basic operators exist in ASCII).

### 12.2 Named Functions (`\log`, `\ln`, `\sin`, `\cos`, `\tan`, etc.)

- Convention: function names are **upright** (not italic) in standard mathematics.
- In the handwriting context: rendered with `italic: false` in the `Seg`.
- If the function has a subscript (e.g. `\log_2`), the subscript is a `SupSubNode` wrapping the `FunctionNode`.

---

## 13. Greek Letters & Special Symbol Strategy

### 13.1 The Font Coverage Problem

Most Google Fonts cursive handwriting fonts (Caveat, Kalam, Shadows Into Light, Architects Daughter, Indie Flower, etc.) cover only the **Basic Latin** block (U+0020–U+007E). Drawing `α` (U+03B1), `θ` (U+03B8), `Σ` (U+03A3), or `∫` (U+222B) via `ctx.fillText()` causes the browser to **fall back to system serif or sans-serif fonts** (Arial, Times New Roman), completely breaking the handwritten immersion.

### 13.2 Solution: Handwritten Vector Glyph Paths

File: `src/lib/math/glyphs.ts`

For high-frequency mathematical symbols, we define parameterized **vector stroke paths** — sequences of `moveTo`, `lineTo`, and `bezierCurveTo` calls — that closely mimic how a student would naturally write each symbol with a pen.

Each glyph path function signature:
```typescript
export type GlyphDrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  baselineY: number,
  size: number,
  settings: HandwritingSettings,
  random: () => number,
  ink: string,
) => { width: number; ascent: number; descent: number };
```

**Priority symbols with custom vector paths:**

| Symbol | Unicode | Priority |
|---|---|---|
| `α` (alpha) | U+03B1 | High |
| `β` (beta) | U+03B2 | High |
| `θ` (theta) | U+03B8 | High |
| `λ` (lambda) | U+03BB | High |
| `π` (pi) | U+03C0 | High |
| `μ` (mu) | U+03BC | Medium |
| `σ` (sigma) | U+03C3 | Medium |
| `ω` (omega) | U+03C9 | Medium |
| `Δ` (Delta) | U+0394 | Medium |
| `Σ` (Sigma) | U+03A3 | High |
| `Ω` (Omega) | U+03A9 | Low |
| `∫` (integral) | U+222B | High |
| `∂` (partial) | U+2202 | Medium |
| `∞` (infinity) | U+221E | High |
| `≤` (leq) | U+2264 | High |
| `≥` (geq) | U+2265 | High |
| `≠` (neq) | U+2260 | High |
| `≈` (approx) | U+2248 | High |
| `±` (pm) | U+00B1 | Medium |
| `√` (radical, standalone) | U+221A | High |

All vector path operations are routed through `inkLine()` and `ctx.bezierCurveTo()` from `pen.ts`, applying standard pen pressure, wobble jitter, and ink thickness that match the active handwriting personality.

### 13.3 Fallback Strategy

For symbols without a dedicated vector path:
1. Attempt `ctx.fillText()` with the handwriting font — if the font covers the glyph, render it.
2. If the browser font metric (`fontBoundingBoxAscent`) indicates a fallback font, apply character-level PRNG jitter (rotation ±3°, baseline jitter ±1px) to reduce the obvious "digital box" appearance.
3. Log a warning in development mode to track which symbols need vector path implementations.

---

## 14. Nested Expression Handling

Nesting is handled by the recursive nature of `MathNode[]` arrays and the `MathLayoutBox` tree.

**Key constraint**: Each nesting level applies a scale damping factor:
- Level 0 (root): `1.0 ×`
- Level 1 (fraction bodies, exponents): `0.80 ×`
- Level 2+ (subscripts-of-exponents, fractions-in-fractions): clamped at `0.60 ×` to prevent unreadably small ink strokes.

**Tall delimiters**: A `GroupedNode` with `left(`, `right)` measures the total ascent and descent of its enclosed content and renders **stretchy parentheses** — smooth Bézier arcs scaled proportionally to the content height. This ensures `\left(\frac{a}{b}\right)` produces parentheses that visually enclose the full fraction.

---

## 15. Handwriting Rendering Strategy

The rendering pipeline for a math block:

```
MathNode[] AST
    ↓
src/lib/math/layout.ts
    → layoutMathBlock(ast, ctx, settings, scale)
    → MathLayoutBox (width, ascent, descent, draw())

renderer.ts — drawMathBlock(placement, ...)
    → Calls mathBox.draw(ctx, originX, baselineY, settings, random, ink)
    → Inside draw():
        Glyphs/variables: writeSegments(ctx, seg, settings, x, y, random, pen)  [pen.ts]
        Lines/bars:       inkLine(ctx, x1, y1, x2, y2, random, ink, width)      [pen.ts]
        Radical arcs:     ctx.bezierCurveTo(...) with jitter                     [pen.ts helpers]
        Brackets:         Bézier stretch arcs with pen pressure variation        [pen.ts helpers]
```

`pen.ts` **never sees** `MathNode`, `MathLayoutBox`, `FractionNode`, or any math-domain type. It receives only primitive Canvas 2D operations.

---

## 16. Pagination Behavior

Math blocks participate in `paginate()` in `layout.ts` as atomic `FlowMathBlock` items:

1. Each math block has a pre-computed `lineUnits = ceil(totalHeight / rulingSpacing)`.
2. If `currentLineIndex + lineUnits > pageCapacity` and the page already has content, the entire math block moves to the top of the next page.
3. A math block **never splits across pages**. A fraction numerator on page 1 and denominator on page 2 is unacceptable.
4. If a single formula exceeds a full page's capacity (extreme edge case — very tall integral limits), the layout engine scales it proportionally to fit within one page.
5. Gap lines before and after math blocks follow the same `gapLines` semantics as text lines.

---

## 17. Performance Strategy

| Concern | Strategy |
|---|---|
| **Repeated parsing** | LaTeX string → AST is a pure function; cache in a `Map<string, MathNode[]>` keyed by LaTeX source. |
| **Layout recalculation** | Layout box tree depends only on `(latex, fontSize, fontFamily, scale)`. Cache `MathLayoutBox` roots in a `Map<string, MathLayoutBox>`. Invalidate when settings change. |
| **Canvas draw cost** | Math drawing uses direct Canvas 2D path commands with no DOM access; benchmark target < 2ms per complex equation. |
| **Typing latency** | Math blocks in the editor are `contenteditable="false"` — typing inside the editor does not trigger math re-parsing until the user opens and updates the formula modal. |
| **Preview latency** | The formula modal renders a separate mini-canvas preview with debounced 100ms re-render on LaTeX change. |

---

## 18. Dependency Evaluation

| Candidate | Bundle Size | Licensing | Handwriting Compatibility | Decision |
|---|---|---|---|---|
| **Custom zero-dep engine** | **~15 KB** | MIT (own code) | **100% authentic** | **ADOPTED** |
| KaTeX | ~350 KB | MIT | Digital SVG / CSS — incompatible | REJECTED |
| MathJax v3 | ~1.2 MB | Apache 2.0 | Digital SVG / WebFonts — incompatible | REJECTED |
| MathLive | ~2.5 MB | MIT | Digital web components — incompatible | REJECTED |
| temml | ~85 KB | MIT | MathML output — incompatible with Canvas | REJECTED |

**Conclusion**: All existing math rendering libraries produce **digital-looking digital output** (SVG, MathML, CSS). None can produce canvas-native handwritten strokes. Building a purpose-built lightweight math engine is the only correct solution.

---

## 19. Proposed File & Module Structure

```
src/
├── lib/
│   ├── math/                              [NEW module — all math concerns]
│   │   ├── types.ts                       MathNode AST, MathLayoutBox interface
│   │   ├── tokens.ts                      LaTeX tokenizer (TokenKind, Token[])
│   │   ├── parser.ts                      Recursive-descent parser: LaTeX → MathNode[]
│   │   ├── layout.ts                      2D box layout engine: MathNode[] → MathLayoutBox
│   │   ├── glyphs.ts                      Handwritten vector paths for Greek & special symbols
│   │   └── index.ts                       Public API: parseMath(), layoutMath()
│   │
│   └── handwriting/
│       ├── parse.ts                       [EXTEND] Add BlockKind "math", MathBlockData, math Seg
│       ├── layout.ts                      [EXTEND] Add FlowMathBlock, call layoutMath()
│       ├── renderer.ts                    [EXTEND] Add drawMathBlock() dispatching to math layout
│       └── pen.ts                         [UNCHANGED] Pure glyph/ink/stroke primitive engine
│
└── components/
    └── editor/
        ├── EditorToolbar.tsx              [EXTEND] Add Math (√) button
        ├── MathFormulaModal.tsx           [NEW] LaTeX input + symbol palette + live preview
        └── RichContentEditor.tsx          [EXTEND] Handle math-block non-editable DOM nodes
```

---

## 20. Editor UX Proposal

### 20.1 Toolbar Integration

The `[Math]` button (icon: `√x` or `Σ`) appears in `EditorToolbar.tsx` in the formatting section. It activates/opens the formula editor modal.

When the cursor is adjacent to a `math-block` node:
- The `[Math]` button highlights (active state).
- Clicking it opens the formula editor pre-populated with the existing LaTeX.

### 20.2 Formula Editor Modal / Popover

A compact, non-intrusive popover appears above or below the toolbar:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✱ Insert Mathematical Formula                                        [✕]    │
├──────────────────────────────────────────────────────────────────────────── ┤
│ LaTeX:  [\frac{3}{8}\log_2\!\left(\frac{3}{8}\right)              ] [?]    │
├──────────────────────────────────────────────────────────────────────────── ┤
│ Quick Insert:                                                               │
│ [a/b] [x²] [x₁] [√x] [√ⁿx]  │  [α][β][θ][λ][π][∞]  │  [±][≤][≥][≠][≈] │
│                                │  [Σ][∫][∂][Δ][Ω]     │                   │
├──────────────────────────────────────────────────────────────────────────── ┤
│ Preview (Handwritten):                                                      │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  [Live canvas preview — rendered with active handwriting personality] ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
├──────────────────────────────────────────────────────────────────────────── ┤
│                                             [Cancel]  [Insert Formula →]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 20.3 In-Editor Representation

Inserted math displays as a styled, non-editable block pill in the editor content area:
- Display block: `[Math: \frac{3}{8}\log_2(\frac{3}{8})...]` with a math icon, using `contenteditable="false"`.
- Clicking the block re-opens the formula editor.
- The block participates in cursor navigation (users can place cursor before/after it with arrow keys).
- Backspace/Delete on a selected math block removes it.

---

## 21. Test Strategy

### 21.1 Parser Tests (`tests/test-math-parser.ts`)

```
✓ Parse plain number: "3" → NumberNode
✓ Parse identifier: "x" → IdentifierNode (italic)
✓ Parse simple fraction: \frac{a}{b}
✓ Parse nested fractions: \frac{\frac{1}{2}}{3}
✓ Parse superscript: x^2 → SupSubNode (sup only)
✓ Parse subscript: x_1 → SupSubNode (sub only)
✓ Parse both: x_1^2 → SupSubNode (both)
✓ Parse sqrt: \sqrt{x}
✓ Parse nth root: \sqrt[3]{8}
✓ Parse sqrt with nested: \sqrt{a^2 + b^2}
✓ Parse log with subscript: \log_2(x) → FunctionNode with SupSubNode
✓ Parse Greek symbols: \alpha, \beta, \theta, \Sigma
✓ Parse special symbols: \leq, \geq, \neq, \approx, \infty
✓ Parse big operator: \sum_{i=0}^{n} x_i
✓ Parse integral: \int_a^b f(x)\,dx
✓ Parse complex formula: \text{Entropy}(S) = -\frac{3}{8}\log_2(\frac{3}{8}) - \frac{5}{8}\log_2(\frac{5}{8})
✓ Resilient parse of unknown command: \unknown{x} → IdentifierNode("\\unknown")
✓ Resilient parse of unclosed brace: \frac{a (uses rest as denominator)
```

### 21.2 Layout Tests (`tests/test-math-layout.ts`)

```
✓ Simple identifier has positive width, ascent, descent
✓ Fraction ascent > identifier ascent
✓ Fraction width ≥ max(numerator.width, denominator.width)
✓ Superscript increases box ascent
✓ Subscript increases box descent
✓ Root box width > radicand width
✓ lineUnits = ceil(totalHeight / rulingSpacing) for display block
✓ lineUnits ≥ 1 always
✓ Nested fraction scale is ≤ 0.80 × parent scale
✓ Clamping: scale never drops below 0.60 × base
✓ Total formula width ≤ A4 content width (overflow handled)
```

### 21.3 Pagination Tests (`tests/test-math-pagination.ts`)

```
✓ Math block moves atomically to next page if it would overflow
✓ Math block never splits (numerator on p1, denominator on p2)
✓ Text after math block continues on correct baseline
✓ Gap lines before math block handled correctly
✓ Very tall math block fits within single A4 page via scale clamping
```

---

## 22. Browser E2E Strategy

1. Open editor; insert math block via toolbar modal with formula: `\text{Entropy}(S) = -\frac{3}{8}\log_2\!\left(\frac{3}{8}\right) - \frac{5}{8}\log_2\!\left(\frac{5}{8}\right)`
2. Verify the live canvas preview in the modal renders a handwritten fraction, log subscript, and minus signs — no digital SVG artifacts.
3. Click "Insert Formula" — verify the math block appears in the editor as a non-editable pill.
4. Verify the A4 page canvas renders the complete formula with organic pen strokes, slant, and baseline jitter matching the active handwriting personality.
5. Verify Greek letters (`α`, `θ`) and special symbols (`Σ`, `∫`, `≤`) appear handwritten, not digital system-font fallbacks.
6. Insert a text paragraph before and after the math block — verify proper ruled-baseline alignment and no content overlap.
7. Insert enough content to force the math block across a page boundary — verify it moves atomically (not splits) to the next page.
8. Test table cell containing inline math — verify it renders within the table bounds without overflowing.
9. Click the math block in the editor — verify the formula editor opens pre-populated with the existing LaTeX.
10. Export to PDF — verify handwritten math renders at high resolution without pixelation or font fallback artifacts.

---

## 23. Relationship to Existing Pipeline

Math extends the existing pipeline without modifying its fundamental contracts:

```
RichContentEditor (contenteditable HTML)
    │
    │  HTML string containing <div class="math-block" data-latex="...">
    ▼
parse.ts — parseHtmlContent()
    │  Detects math-block divs and math-inline spans
    │  Emits Block { kind: "math", math: { latex, ast } }
    │  For inline: emits Seg { ..., mathAst: MathNode[] }
    ▼
layout.ts — buildFlow() / tableRows() / blockLines()
    │  Math blocks → FlowMathBlock with computed lineUnits
    │  Inline math segs → measured via math layout engine width
    │  Pagination: mathBlock is atomic (never split)
    ▼
renderer.ts — drawMathBlock()
    │  Calls src/lib/math/layout.ts to get MathLayoutBox
    │  Calls MathLayoutBox.draw() to execute canvas operations
    │  draw() internally calls:
    │     pen.writeSegments()  for characters/identifiers
    │     pen.inkLine()        for fraction bars, radicals
    │     ctx.bezierCurveTo()  for brackets, integral curves
    ▼
Canvas — authentic handwritten mathematical output
```

---

*Document Status: Architecture analysis complete. Approved for implementation.*
*See: [MATH_NOTATION_PLAN.md](./MATH_NOTATION_PLAN.md) for the phased implementation plan.*
*See: [decisions/ADR-008-math-notation-architecture.md](./decisions/ADR-008-math-notation-architecture.md) for the key architectural decision record.*
