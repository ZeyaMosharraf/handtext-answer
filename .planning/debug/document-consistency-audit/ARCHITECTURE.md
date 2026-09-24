# HandText Document Consistency Audit: Architecture Analysis

## 1. Document Lifecycle & Data Flow

```
[User Input in Editor / Modals]
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ Left Editor DOM State (RichContentEditor.tsx)            │
│ - Monolithic <div contenteditable="true">                │
│ - Embeds: <div class="math-block" data-latex="...">      │
│ - Embeds: <div class="graph-block" data-graph-def="..."> │
│ - Embeds: <table data-align="...">                       │
│ - Embeds: <p data-margin-marker="...">                   │
└──────────────────────────────────────────────────────────┘
               │ el.innerHTML (via triggerChange)
               ▼
┌──────────────────────────────────────────────────────────┐
│ Document State (EditorWorkspace.tsx)                     │
│ - content: raw HTML string (Single Source of Truth)      │
│ - settings: HandwritingSettings                          │
│ - past[] / future[]: 500ms-debounced history snapshots   │
│ - IndexedDB / Supabase: serialized HTML strings          │
└──────────────────────────────────────────────────────────┘
               │
       ┌───────┴──────────────────────────────┐
       │ (Live Preview / Generate)             │
       ▼                                      ▼
┌───────────────────────────────┐ ┌──────────────────────────────────────┐
│ HTML Parser (parse.ts)        │ │ Orphaned Block Model (UNUSED)        │
│ 1. Regex pre-pass:            │ │ - src/types/document.ts              │
│    data-latex=["']([^"']*)["']│ │ - src/lib/editor/blockSerialization  │
│ 2. Tag matching (blockRegex)  │ │ - src/hooks/useDocumentBlocks.ts     │
│ 3. Produces Block[] AST:      │ │ - src/components/editor/             │
│    - BlockKind: paragraph,    │ │   BlockListContainer.tsx             │
│      heading, math, table,    │ │   (Completely bypassed in production)│
│      graph, blank             │ └──────────────────────────────────────┘
└───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ Layout Engine (src/lib/handwriting/layout.ts)            │
│ 1. buildFlow():                                          │
│    - Text: wrapSegments() -> FlowLine[]                  │
│    - Math: parseMath() -> layoutMath() -> FlowMathBlock  │
│    - Table: tableRows() -> FlowTableRow[]                │
│    - Graph: layoutGraph() -> FlowGraphBlock              │
│ 2. paginate():                                           │
│    - Page coordinate system (activeCoordinateSystem)     │
│    - Capacity checking against firstBaselineY + N*ruling │
│    - Produces LayoutPage[] with LayoutPlacement[]        │
└──────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ Handwritten Canvas Renderer (src/lib/handwriting/        │
│                              renderer.ts)                │
│ - Paper ruling & margins drawn                           │
│ - Placements rendered via writeSegments (pen.ts)         │
│ - Math drawn via box.draw()                              │
│ - Tables drawn via inkLine()                             │
│ - Graphs drawn via graphBox.draw()                       │
│ - Margin markers drawn via renderPlacementMarginMarker() │
└──────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ Right Side A4 Canvas Output (EditorWorkspace canvas)     │
└──────────────────────────────────────────────────────────┘
```

---

## 2. In-Depth Layer Breakdown

| Stage | Data Structure | Source of Truth | Transformations & Conversions | Lossy / Risk Points |
|---|---|---|---|---|
| **1. User Input** | DOM Events (`input`, `keydown`, `paste`, modal submit) | User interaction | Keystrokes -> DOM mutations / `execCommand` | Browser-dependent HTML structure; `<br>` vs `<p>` variations. |
| **2. Editor State** | Browser DOM (`HTMLElement`) | `editorRef.current.innerHTML` | `formatMathBlockInner` formats preview; `.setAttribute` stores LaTeX | Invalid HTML generated if block tags nested inside `<p>` or `<span>`. |
| **3. Serialization** | HTML string | `el.innerHTML` | Native browser DOM serialization | Attributes are double-quoted; single quotes `'` inside attributes are NOT escaped. |
| **4. Persistence** | JSON snapshot (`ProjectSnapshot`) | `draft.content` (HTML string) | `migrateLegacyContentToHtml`, IndexedDB, Supabase | Race conditions with fast typing vs 500ms history commit; beforeunload loss. |
| **5. Parser** | `Block[]` (Handwriting internal AST) | HTML string | Regex tokenization, HTML entity decoding (`unescapeHtml`) | **Catastrophic regex failure**: `data-latex=["']([^"']*)["']` truncates at single quotes; nested `<p>` drops blocks. |
| **6. Math AST** | `MathNode[]` | `latex` string from parsed block | `tokenize()` -> recursive descent `parseMath()` | Multi-character function names without `\` tokenized as individual single-letter variables. |
| **7. Layout Engine** | `LayoutPage[]` (containing `LayoutPlacement[]`) | `Block[]` + `HandwritingSettings` | Math: `layoutMath()`, Text: `wrapSegments()`, Tables: `tableRows()` | Ruling line mismatch (hardcoded 100px margin vs 72px editor); table top coordinate calculates `lineIndex - 1 = -1`. |
| **8. Renderer** | Canvas 2D stroke operations | `LayoutPage[]` | `writeSegments()`, `box.draw()`, `inkLine()` | Jitter, coordinate translation, pen stroke simulation. |
| **9. Canvas Output** | Pixel buffer (`HTMLCanvasElement`) | Canvas context | Scaled via `devicePixelRatio` | Viewport scaling vs writing overlay alignment. |

---

## 3. The Dual Architecture Schism

A central architectural finding of this audit is that **the repository currently contains two completely separate, incompatible block models**:

### Model A: The Orphaned Block Model
- **Files**: `src/types/document.ts`, `src/lib/editor/blockSerialization.ts`, `src/lib/editor/documentOperations.ts`, `src/hooks/useDocumentBlocks.ts`, `src/components/editor/BlockListContainer.tsx`, `TextBlockView.tsx`, `MathBlockView.tsx`, `TableBlockView.tsx`, `GraphBlockView.tsx`.
- **Intended Contract**: Strict typed array `DocumentBlock[]` (`TextBlock`, `MathBlock`, `TableBlock`, `GraphBlock`), each with a unique stable ID (`generateBlockId`), discrete React components for each block, and clean serialization functions (`blocksToHtml`, `htmlToBlocks`).
- **Status in Production**: **100% UNUSED / ORPHANED**. `EditorWorkspace.tsx` never imports or renders `BlockListContainer`.

### Model B: The Active Monolithic HTML Pipeline
- **Files**: `src/components/editor/EditorWorkspace.tsx`, `src/components/editor/RichContentEditor.tsx`, `src/lib/handwriting/parse.ts`, `src/lib/handwriting/layout.ts`, `src/lib/handwriting/renderer.ts`.
- **Actual Implementation**: Single monolithic `contentEditable` `<div>` storing raw HTML strings. Special blocks are represented as `<div class="math-block" data-latex="...">` embedded directly inside editable HTML.
- **Consequences**:
  1. The editor relies on brittle regular expressions in `parse.ts` to reverse-engineer blocks from HTML.
  2. Nested tags (e.g. `<p><div class="math-block">...</div></p>`) break the regex tokenizer and delete blocks.
  3. Attributes containing quotes or special characters are truncated.
  4. Features written for Model A (like clipboard serialization or block operations) are completely out-of-sync with Model B.

---

## 4. Single Source of Truth Evaluation

**Question**: *Do the left digital editor and right handwritten renderer truly share a single source of truth?*

**Verdict**: **NO.**
- The left editor's source of truth is the live **browser DOM tree** inside `RichContentEditor.tsx`.
- The right handwritten page's source of truth is an **ephemeral AST** generated on-the-fly by parsing the serialized `innerHTML` through regexes in `src/lib/handwriting/parse.ts`.
- The two representations diverge significantly:
  1. **Quotes in LaTeX**: Left displays `x' = x - min / max - min` (via `renderDigitalMathToHtml` called on insertion). Right parses `latex: "x"` because regex `data-latex=["']([^"']*)["']` stopped at `'`.
  2. **Margin Width**: Left editor gutter is `72px`. Right handwritten canvas hardcodes `100px`.
  3. **Table Cells**: Left renders rich HTML in table cells. Right serialization in `blocksToHtml` turns cells into `[object Object]`.
  4. **Write-on-Page**: Left holds rich HTML with math and tables. The write-on-page textarea strips everything to plain text, destroying all non-text blocks upon typing.
