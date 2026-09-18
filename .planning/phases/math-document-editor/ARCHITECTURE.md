# M2-P2 — Math & Document Editing UX Redesign — Architecture Specification

> *GSD Architecture Specification — Hybrid Block-Document Model & Handwriting Math Engine*  
> *Phase:* M2-P2  
> *Date:* September 2026  
> *Status:* Architecture Locked — ready for implementation planning  

---

## 1. System Architecture Overview

The redesigned HandText document editor employs a **Hybrid Block-Document Model**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EDITOR ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  useEditorDocumentState (Block Store + Selection State Machine)             │
│   ├── blocks: DocumentBlock[]                                               │
│   │     ├── TextBlock   (id: "b1", html: "<p>Let ...</p>")                  │
│   │     ├── MathBlock   (id: "b2", naturalExpr: "Z1 = X1 W11", latex: "...")│
│   │     ├── TextBlock   (id: "b3", html: "<p>Then ...</p>")                 │
│   │     └── TableBlock  (id: "b4", tableData: TableModel)                   │
│   ├── selectedBlockId: string | null                                        │
│   ├── activeEditingBlockId: string | null                                   │
│   └── insertionAnchorBlockId: string | null                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                           VIEW & INTERACTION LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BlockListContainer                                                         │
│   ├── TextBlockView    (Rich text, contenteditable isolated to block)       │
│   ├── MathBlockView    (Discrete object, selection ring, action chips)      │
│   ├── TableBlockView   (Existing Table architecture wrapped in block)       │
│   └── GraphBlockView   (Existing Graph architecture wrapped in block)       │
│                                                                             │
│  Modals & Overlay Editors:                                                  │
│   ├── SmartMathEditorModal (Natural Math input + Live preview + Symbol palette)
│   └── QuickActionFloatingToolbar (Edit, Delete, Duplicate, Move)           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         STORAGE & SERIALIZATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  htmlToBlocks(html: string) <===========> blocksToHtml(blocks: Block[])      │
│         ▲                                         │                         │
│         │ (Draft load)                            │ (Autosave / Supabase)   │
│  IndexedDB (`handtext_draft`)               Supabase (`projects.content`)    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                        HANDWRITING LAYOUT & RENDERING                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  documentToFlowItems(blocks)                                                │
│         │                                                                   │
│         ▼                                                                   │
│  FlowItem[] ───► PageCoordinateSystem (A4 pagination + ruled lineUnits)     │
│         │                                                                   │
│         ▼                                                                   │
│  HandwritingRenderer (Canvas strokes + baseline anchor on ruled lines)      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Block Data Model

```typescript
// src/types/document.ts

export type BlockType = 'text' | 'math' | 'table' | 'graph';

export interface BaseBlock {
  id: string;             // Stable UUID v4
  type: BlockType;
  createdAt: number;
}

export interface TextBlock extends BaseBlock {
  type: 'text';
  html: string;           // Sanitized rich-text HTML (p, strong, em, u, etc.)
}

export interface MathBlock extends BaseBlock {
  type: 'math';
  naturalExpr: string;    // Student input (e.g. "Z1 = X1 W11 + X2 W21")
  latex: string;          // Canonical compiled LaTeX (e.g. "Z_1 = X_1 W_{11} + X_2 W_{21}")
  displayMode: 'block' | 'compact'; // 'block' centers with margin, 'compact' stays left-aligned
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  tableData: TableModel;  // Existing TableModel (headers, rows, cells, alignments)
}

export interface GraphBlock extends BaseBlock {
  type: 'graph';
  graphDef: GraphDefinition; // Existing GraphDefinition (axes, plots, scatter)
}

export type DocumentBlock = TextBlock | MathBlock | TableBlock | GraphBlock;

export interface DocumentState {
  version: 2;
  blocks: DocumentBlock[];
}
```

---

## 3. Editor State Machine & Interaction Model

### 3.1 Selection State vs. Edit State

```
                      ┌──────────────────────┐
                      │      UNFOCUSED       │
                      └──────────┬───────────┘
                                 │
                 Click / Arrow   │
                                 ▼
      ┌──────────────────────────────────────────────────────┐
      │                   BLOCK SELECTED                     │
      │   - selectedBlockId = "b_math_1"                     │
      │   - Visual: Blue focus outline + Floating action bar │
      │   - Keys:                                            │
      │       Backspace/Delete -> deleteBlock(id)            │
      │       Enter            -> openEditModal(id)          │
      │       ArrowUp/Down     -> selectAdjacentBlock(dir)   │
      │       Esc              -> deselect()                 │
      └──────────────────────────┬───────────────────────────┘
                                 │
            Double-click / Enter │ Click "Edit" chip
                                 ▼
      ┌──────────────────────────────────────────────────────┐
      │                    EDITING BLOCK                     │
      │   - activeEditingBlockId = "b_math_1"                │
      │   - Math Editor Modal opens prefilled with ONLY b1   │
      │   - Live preview updates as student types            │
      │   - Keys:                                            │
      │       Ctrl+Enter -> commitEdit() -> auto-focus next  │
      │       Esc        -> cancelEdit()                     │
      └──────────────────────────────────────────────────────┘
```

### 3.2 Discrete Insertion Flow (Zero Overwriting Guarantee)

When a user clicks "Insert Math" in the toolbar:
1. **Determine Anchor Position:**
   - If a block is currently selected, the anchor is `selectedBlockId`.
   - If the user had their cursor inside a `TextBlock`, the editor determines whether the cursor was at the beginning, middle, or end. If in the middle, the `TextBlock` is cleanly split into two text blocks $[T_1, T_2]$.
   - If no block is selected, the anchor is the end of the document.
2. **Clear Any Stale References:**
   - The editor explicitly passes `mode: 'create'` to `SmartMathEditorModal`.
   - `initialExpression` is strictly empty `""`.
   - No previous formula from another block can ever bleed into the creation flow.
3. **Commit Insertion:**
   - A new `MathBlock` with a new UUID is inserted immediately following the anchor block.
   - **Crucial Continuity Step:** An empty `TextBlock` is automatically created directly following the new `MathBlock` (if one does not already exist).
   - Editor focus is programmatically transferred to the subsequent `TextBlock`. The student can immediately begin typing the next sentence without touching the mouse!

### 3.3 Keyboard Navigation Contract

| Key Event | Scope | Action |
|---|---|---|
| `Ctrl + Shift + M` | Global Editor | Open Insert Math modal anchored at current block |
| `Enter` | Selected Math/Table/Graph Block | Open Edit dialog for the selected block |
| `Delete` / `Backspace` | Selected Math/Table/Graph Block | Delete the block; focus moves to preceding block |
| `Escape` | Edit Modal Open | Close modal without saving changes |
| `Escape` | Block Selected | Deselect block, returning focus to document root |
| `Ctrl + Enter` | Edit Modal Open | Commit changes, close modal, and focus next text block |
| `Up Arrow` | At start of TextBlock | Select the preceding block as an object |
| `Down Arrow` | At end of TextBlock | Select the subsequent block as an object |
| `Down Arrow` | Selected Math Block | Move focus to start of subsequent TextBlock |

---

## 4. Smart Natural Math Parser Architecture

### 4.1 Pipeline Design

```
Natural Student String (e.g. "Z1 = X1 W11 + X2 W21")
                       │
                       ▼
         src/lib/math/naturalParser.ts
                       │
         ├── 1. Raw LaTeX Detection (if \int, \frac, \sum present, bypass transforms)
         ├── 2. Subscript Normalization (e.g. "X1" -> "X_1", "W11" -> "W_{11}")
         ├── 3. Spacing Preservation (spaces between terms -> mathematical spacing)
         ├── 4. Fraction Normalization (e.g. "a/b", "(x+1)/(y-1)" -> "\frac{...}{...}")
         ├── 5. Exponent Normalization (e.g. "x^2" -> "x^{2}")
         ├── 6. Root Normalization (e.g. "sqrt(x+1)" -> "\sqrt{x+1}")
         └── 7. Greek & Operator Mapping (e.g. "alpha" -> "\alpha", "<=" -> "\le")
                       │
                       ▼
      Compiled LaTeX String (e.g. "Z_1 = X_1 W_{11} + X_2 W_{21}")
                       │
                       ▼
          KaTeX AST / MathLayoutBox Pipeline
```

### 4.2 Grammar Specifications

1. **Subscripts:**
   - Match pattern: `/[A-Za-z](\d+)/g` $\to$ `$1_{$2}`
   - Examples: `Z1` $\to$ `Z_{1}`, `X2` $\to$ `X_{2}`, `W11` $\to$ `W_{11}`.
2. **Natural Fractions:**
   - Match pattern: `/(\([^\)]+\)|[a-zA-Z0-9_\^]+)\s*\/\s*(\([^\)]+\)|[a-zA-Z0-9_\^]+)/g`
   - Strips grouping parentheses if present: `(x + 1)/(y - 1)` $\to$ `\frac{x + 1}{y - 1}`.
   - Simple fractions: `a/b` $\to$ `\frac{a}{b}`, `1/2` $\to$ `\frac{1}{2}`.
3. **Square Roots:**
   - `sqrt(...)` $\to$ `\sqrt{...}`.
4. **Natural Horizontal Spacing:**
   - In standard LaTeX, `X1 W11` is squished into $X1W11$.
   - The natural parser preserves spaces between independent terms by inserting `\,` (thin space) or `\quad` where appropriate.
   - Comma-separated equations (`W11 = -1, W12 = 2`) automatically append `\quad` after commas.
5. **Raw LaTeX Passthrough:**
   - If the input contains backslash commands like `\begin`, `\frac`, `\int`, `\sum`, `\matrix`, the parser operates in raw passthrough mode, ensuring complete backwards compatibility with existing formulas.

---

## 5. Math Layout & Ruled-Line Geometry Engine (Proposed Corrections — Phase 4)

> [!NOTE]
> **Status:** Root causes diagnosed and mathematical formulas documented below. Implementation and visual verification on the ruled paper canvas are scheduled for Phase 4 of the implementation plan.

### 5.1 Proposed Correction for Vertical Inflation (`computeLineUnits`)

* **Existing Defect in `src/lib/math/layout.ts`:**
  ```typescript
  // Old over-sensitive code:
  if (totalHeight <= rulingSpacing * 1.05) { return 1; }
  ```
  At `rulingSpacing = 28`, threshold is $29.4\text{px}$. A simple $x^2$ or $x_1$ has height ~30–33px and gets bumped to 2 lines ($56\text{px}$), leaving huge white gaps.

* **Architectural Correction:**
  ```typescript
  // New corrected formula in src/lib/math/layout.ts:
  export function computeLineUnits(
    box: MathLayoutBox,
    rulingSpacing: number = DEFAULT_RULING_SPACING
  ): number {
    const totalHeight = box.height;
    // Standard compact math (variables with superscripts, single fractions, etc.)
    // can naturally fit within 1.35x rulingSpacing because handwriting ascenders
    // and descenders comfortably share the inter-line space.
    if (totalHeight <= rulingSpacing * 1.35) {
      return 1;
    }
    // Complex equations (matrices, large summations, integrals, stacked fractions)
    return Math.max(1, Math.ceil(totalHeight / (rulingSpacing * 1.15)));
  }
  ```

### 5.2 Fixing Baseline Misalignment in `renderer.ts`

* **Existing Defect in `src/lib/handwriting/renderer.ts` line 419:**
  ```typescript
  // Old buggy code:
  let baselineY = ruledLineY;
  if (box.descent > rulingSpacing * 0.12) {
    baselineY = ruledLineY - box.descent; // Lifts formula off the ruled line!
  }
  ```

* **Architectural Correction:**
  - In a handwritten ruled notebook, the main baseline of math (e.g. the line where $x$, $+$, $=$, $z$ sit) **must sit directly on `ruledLineY`** (with standard pen baseline offset applied).
  - Descenders ($y$, $p$, subscripts $x_1$, denominator of fractions) naturally extend **below** the ruled line.
  - The code lifting `baselineY` must be removed entirely:
  ```typescript
  // Corrected alignment:
  const baselineY = ruledLineY;
  // All glyphs are drawn relative to this stable baseline.
  box.draw(ctx, originX, baselineY, pen);
  ```

### 5.3 Fraction and Delimiter Scaling
- Fraction bar line thickness: $1.2\text{px}$ matching ink stroke width.
- Numerator / Denominator vertical gap: $3\text{px}$ above/below the fraction bar (reducing vertical sprawl).
- Delimiters (parentheses, brackets): Height calculated dynamically from the inner expression height rather than inflating to fixed excessive sizes.

---

## 6. Table & Graph Block Compatibility

### 6.1 Table Block Invariant Preservation
The existing Table Editing Architecture (`src/types/table.ts`, `tableLayout.ts`, `TableEditor.tsx`) is preserved 100%:
- A `TableBlock` encapsulates the existing `TableModel`.
- In the block sequence, `TableBlockView` renders the table with its existing column-resizing, row insertion, and compact row height mechanics.
- In `documentToFlowItems`, the table emits its existing table flow item with calculated `lineUnits`.
- Pagination across pages continues to break rows across pages as currently designed.

### 6.2 Graph Block Invariant Preservation
The newly completed Graph subsystem (`src/lib/graph/`) fits seamlessly:
- A `GraphBlock` encapsulates `GraphDefinition`.
- It renders in the editor with its interactive preview.
- It compiles into a graph flow item with integer lineUnits.

---

## 7. Persistence & Migration Architecture

### 7.1 Data Flow

```
[User Types in Editor]
        │
        ▼
[DocumentState: BlockNode[]] ──(Auto-save debounce 500ms)──► [blocksToHtml()]
                                                                    │
                                                                    ▼
                                                            Semantic HTML String
                                                                    │
                                    ┌───────────────────────────────┴───────────────────────────────┐
                                    ▼                                                               ▼
                     IndexedDB (`handtext_draft`)                                     Supabase (`projects.content`)
```

### 7.2 HTML Serialization Specification (`blocksToHtml`)

```html
<!-- Text Block -->
<div data-block-id="b_txt_1" data-block-type="text">
  <p>First line of text...</p>
</div>

<!-- Math Block -->
<div data-block-id="b_math_2" data-block-type="math" data-natural-expr="Z1 = X1 W11" data-latex="Z_1 = X_1 W_{11}" data-display-mode="block" class="math-block">
  <!-- Fallback rendered KaTeX for static view/print -->
</div>

<!-- Table Block -->
<div data-block-id="b_tbl_3" data-block-type="table">
  <table class="handtext-table" data-table-data="...">...</table>
</div>

<!-- Graph Block -->
<div data-block-id="b_grp_4" data-block-type="graph" data-graph-def="...">
  ...
</div>
```

### 7.3 HTML Deserialization Specification (`htmlToBlocks`)

When loading an existing project or draft:
1. Parse the incoming HTML string with `DOMParser`.
2. Inspect child nodes of the root:
   - If child has `data-block-type`, instantiate the corresponding `DocumentBlock` using its saved attributes.
   - If child is an unadorned `<div class="math-block" data-latex="...">` (legacy HandText project), extract `latex`, generate a stable block UUID, and convert it into a `MathBlock`.
   - If child is an unadorned `<table class="handtext-table">`, parse it into a `TableBlock`.
   - If child is an unadorned `<div class="graph-block">`, parse it into a `GraphBlock`.
   - All surrounding `<p>`, `<h1>`, `<ul>`, etc. nodes are collected into contiguous `TextBlock` units.
3. **Zero Data Loss Guarantee:** Every legacy document loads cleanly into the new block model without requiring any database schema migrations or manual user intervention.

---

## 8. Summary of Architectural Decisions (ADR)

| Decision | Chosen Option | Rejected Option | Rationale |
|---|---|---|---|
| **Editor Data Structure** | Flat ordered array of typed blocks (`DocumentBlock[]`) | Single monolithic contenteditable HTML div | Solves browser caret loss, formula overwriting, and widget deletion bugs. |
| **Object Interaction Model** | PowerPoint/Notion-style discrete object selection | Freeform floating canvas `(x, y)` | Freeform positioning breaks notebook ruled lines and A4 vertical pagination. |
| **Math Input Language** | Smart Natural Math (AsciiMath-style) with LaTeX toggle | Strict raw LaTeX only | Greatly reduces cognitive friction for students while keeping raw LaTeX available for advanced users. |
| **Math Continuity** | Auto-create & focus subsequent TextBlock after math insertion | Leave cursor at boundary of non-editable widget | Enables natural, continuous typing without mouse clicks. |
| **Baseline Alignment** | Math baseline strictly anchored to `ruledLineY` | Subtracting `box.descent` to lift formula | Notebook handwriting rests on the line; descenders extend naturally below the line. |
| **Single-Line Math LineUnits** | Threshold raised to `1.35 * rulingSpacing` | `1.05 * rulingSpacing` | Eliminates unnatural 2-line vertical gaps for formulas like $x^2$ and $x_1$. |
| **Storage Compatibility** | Two-way HTML $\leftrightarrow$ Block converter | Custom proprietary JSON format | Preserves 100% backward compatibility with Supabase projects and local IndexedDB drafts. |
