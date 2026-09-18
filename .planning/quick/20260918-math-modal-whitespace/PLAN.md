---
slug: math-modal-whitespace
date: 2026-09-18
status: in-progress
---

# Quick Task: Fix Math Formula Editor Modal Whitespace and Expression Spacing

## Problem
In the Math Formula Editor modal:
1. Typed spaces entered by the user are not being preserved because `src/lib/math/tokens.ts` skips all `/\s/` characters, discarding them before parsing.
2. In `src/lib/math/parser.ts`, `t.kind === "SPACE"` was not handled in `parseNode()`, returning `null`.
3. Delimiters (parentheses, brackets, curly braces, pipes) in `src/lib/math/layout.ts` had an advance width of only `0.22 * size`, leaving ~1.18px clearance between delimiter ink and inner content, causing visual collisions with adjacent characters (e.g. `F(Y)`, `[ x + y ]`, `( x + y )`, `| x |`).
4. Curly brace groups `{ ... }` at top level parsed with `open: "", close: ""` invisible grouping delimiters instead of visible curly braces `{` and `}`.
5. Punctuation operators `,`, `;`, `:` had `0.22em` left spacing added, causing awkward separation before commas and semicolons.

## Solution
1. In `src/lib/math/tokens.ts`:
   - Tokenize whitespace as `SPACE` tokens (respecting LaTeX control-word termination rules so single space after multi-letter command terminates command name).
   - Recognize multi-character relational operators like `>=` (`\geq`), `<=` (`\leq`), `!=` (`\neq`), `->` (`\to`), `=>` (`\Rightarrow`).
   - Tokenize `\{` and `\}` as `LBRACE` and `RBRACE`.
2. In `src/lib/math/parser.ts`:
   - Handle `t.kind === "SPACE"` in `parseNode()` to return a `SpaceNode` with `widthEm: 0.28`.
   - In `parseNode()`, handle top-level `LBRACE` to produce a visible curly group `{ ... }` with `open: "{"` and `close: "}"` (or `""` if unclosed).
3. In `src/lib/math/layout.ts`:
   - Increase delimiter width from `0.22 * size` to `0.34 * size` and center delimiter curves at `cx = x + size * 0.17`, providing clean ~3px breathing room preventing character collisions.
   - For punctuation `,`, `;`, `:`, set `leftSpacing = 0` and `rightSpacing = 0.15em` so punctuation hugs preceding terms naturally without spurious left gaps.
4. Add focused regression tests for all 10 expressions and run browser UAT.
