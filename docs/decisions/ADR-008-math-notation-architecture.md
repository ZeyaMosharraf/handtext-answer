# ADR-008: Mathematical Notation Architecture

- **Status**: Accepted `[PLANNED — Pending Implementation]`
- **Date**: September 2026
- **Context**: HandText students frequently need to express mathematical formulas — including probability, calculus, entropy, and algebraic expressions — in their handwritten answers. The final A4 canvas output must render mathematics in the same handwritten personality as surrounding text, not as digital SVG equations stamped onto notebook paper.

- **Decision**:
  1. Build a bespoke, zero-dependency mathematical notation subsystem in `src/lib/math/` covering LaTeX tokenization, recursive-descent parsing, 2D box layout, and handwritten vector glyph paths for Greek and special symbols.
  2. Adopt a **Hybrid LaTeX Input Model**: LaTeX strings as the storage format, paired with a compact formula insertion modal offering a quick-symbol palette and live handwritten canvas preview.
  3. Math blocks are stored in the editor as `contenteditable="false"` DOM nodes with `data-latex` attributes. Math inline spans use `class="math-inline" data-latex="..."`.
  4. Math blocks participate in the existing pagination system as **atomic flow units** (never split across pages), consuming integer `lineUnits` computed from their 2D height divided by `rulingSpacing`.
  5. The rendering pipeline remains: `parse.ts` → `layout.ts` → `renderer.ts` → `pen.ts`. The math module integrates at `layout.ts` (for 2D box dimensions) and `renderer.ts` (for draw call dispatch). `pen.ts` remains strictly a glyph/ink/stroke primitive engine.

- **Rejected Alternatives**:
  - **KaTeX** (~350 KB): Produces SVG/HTML output, not canvas strokes. Digital appearance incompatible with handwritten immersion.
  - **MathJax v3** (~1.2 MB): Same SVG/HTML/WebFont output; bundle too large.
  - **MathLive** (~2.5 MB): Web component WYSIWYG editor; produces MathML/DOM, not canvas primitives; enormous bundle cost.
  - **Plain Unicode input**: Cannot represent vertical fractions, dynamic radical vinculums, or nested 2D mathematical structures.

- **Reason**:
  - All existing math rendering libraries produce **digital-looking output** (SVG, MathML, CSS layout). None produce canvas-native handwritten pen strokes.
  - A purpose-built ~15 KB lightweight engine gives 100% control over rendering aesthetics, zero external dependencies, and negligible bundle impact.
  - Greek and special symbol coverage is addressed via parameterized handwritten vector stroke paths (not system font fallbacks) in `src/lib/math/glyphs.ts`.

- **Consequences**:
  - **Positive**: Authentic handwritten mathematical output; zero bundle bloat; full control over aesthetics; pen.ts isolation preserved.
  - **Positive**: Math coexists cleanly with paragraphs, headings, lists, tables, and multi-page pagination.
  - **Neutral**: Requires implementing a bespoke tokenizer, parser, and 2D layout engine (~4 TypeScript files).
  - **Negative**: Initial vector path library for Greek symbols requires careful artistic tuning.

- **Full Architecture**: See [MATH_NOTATION_ARCHITECTURE.md](../MATH_NOTATION_ARCHITECTURE.md)
- **Implementation Plan**: See [MATH_NOTATION_PLAN.md](../MATH_NOTATION_PLAN.md)
