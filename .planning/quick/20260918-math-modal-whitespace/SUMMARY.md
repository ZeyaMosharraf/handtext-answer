---
slug: math-modal-whitespace
date: 2026-09-18
status: complete
---

# Quick Task Summary: Math Formula Editor Whitespace & Delimiter Geometry Fix

## Root Cause
1. **Whitespace Discarded by Tokenizer**: `src/lib/math/tokens.ts` unconditionally skipped all whitespace characters (`/\s/`), dropping typed spaces before they reached the parser.
2. **Missing `SPACE` Handling in Parser**: `src/lib/math/parser.ts` `parseNode()` did not handle `t.kind === "SPACE"`, returning `null`.
3. **Delimiter Visual Collision**: In `src/lib/math/layout.ts`, delimiters (`(`, `)`, `[`, `]`, `{`, `}`, `|`) had an advance width of only `0.22 * size`, placing delimiter ink less than ~1.2px from adjacent text or enclosed content, causing visual collisions.
4. **Top-Level Braces Invisible**: `src/lib/math/parser.ts` mapped top-level `{ ... }` to `GroupedNode` with `open: "", close: ""` (invisible grouping) instead of visible curly braces `{` and `}`.
5. **Awkward Punctuation Spacing**: `layoutOperator` added `0.22em` spacing to both the left and right of `,`, `;`, and `:`, creating spurious gaps before punctuation.

## Surgical Changes Made
1. **`src/lib/math/tokens.ts`**:
   - Tokenizes whitespace into `kind: "SPACE"` tokens while absorbing standard single spaces adjacent to binary operators into the operator's built-in mathematical spacing.
   - Maps multi-character relational operators commonly typed in formulas (`>=` to `\geq` [≥], `<=` to `\leq` [≤], `!=` to `\neq` [≠], `->` to `\to` [→], `=>` to `\Rightarrow` [⇒]) to single semantic commands.
   - Tokenizes visible braces `\{` and `\}` as `LBRACE` and `RBRACE`.
2. **`src/lib/math/parser.ts`**:
   - Handles `t.kind === "SPACE"` in `parseNode()`, returning `{ type: "space", widthEm: 0.28 } as SpaceNode`.
   - Top-level `LBRACE` creates a `GroupedNode` with visible curly delimiters `open: "{"` and `close: "}"` (or `""` if unclosed).
3. **`src/lib/math/layout.ts`**:
   - Expanded delimiter advance width from `0.22 * size` to `0.34 * size` with curve centering at `cx = x + size * 0.17`, providing natural clearance (~3px) and eliminating visual collisions with adjacent characters.
   - For punctuation `,`, `;`, `:`, set `leftSpacing = 0` so commas and semicolons hug preceding characters naturally.
4. **`src/components/editor/MathFormulaModal.tsx`**:
   - Passes `latex.trimStart()` to `parseMath` for the live preview so that trailing spaces typed by the user immediately update the live preview canvas without awaiting subsequent characters.

## Verification
- `tests/test-math-whitespace.ts`: Verified all 10 expressions with exact assertions on tokens, ASTs, layout box dimensions, delimiter width >= 0.34em, comma spacing, and source preservation.
- `tests/test-mathblock-visual-rendering.ts`: 36 passed, 0 failed.
- `tests/test-math-parser.ts`: 18 passed, 0 failed.
- `tests/test-math-layout.ts`: 14 passed, 0 failed.
- `npm run build`: Production build succeeded in 334ms with 0 errors.
