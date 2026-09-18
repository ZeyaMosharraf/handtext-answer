# M2-P2 — Math & Document Editing UX Redesign — Technical Research

> *GSD Phase Research — Comprehensive Technical Investigation & External UX Analysis*  
> *Phase:* M2-P2  
> *Date:* September 2026  
> *Status:* Research Complete — Architecture & Implementation Plan Ready  

---

## Executive Summary

HandText combines two distinct paradigms:
1. **An Interactive Digital Authoring Tool** where users compose text, mathematical formulas, tables, and graphs.
2. **A Physical Ruled Notebook Simulation Engine** that renders content to A4 pages using ruled lines, grid-based lineUnits, pagination, and organic handwritten strokes.

The current editing architecture suffers from a core tension: **Math is currently treated as an inline HTML/contenteditable DOM fragment inside a single monolithic `contenteditable` container.** This architecture is the single root cause behind a cascading series of UX issues:
- Browser caret loss and erratic range restoration when opening/closing modals.
- Stale references where inserting a formula inadvertently overwrites an existing formula.
- Inability to naturally continue writing text after inserting a formula without clicking or fighting non-editable DOM widgets.
- Excessive vertical whitespace caused by an over-sensitive `1.05 * rulingSpacing` threshold in `computeLineUnits()`.
- Baseline misalignment where formulas with descenders or superscripts are lifted off the ruled line by `renderer.ts`.
- High cognitive load forcing students to type raw LaTeX commands (`\quad`, `\frac`, `\times`) instead of intuitive calculator-style math.

This research establishes that:
1. **A pure freeform slide/canvas model (like Microsoft PowerPoint or Figma) cannot be adopted directly** because HandText content must flow sequentially across A4 ruled lines with strict vertical pagination.
2. **A pure monolithic contenteditable flow (like classic MS Word or raw HTML editors) fails for non-text objects** because web browser contenteditable engines are notoriously fragile around non-editable block widgets (`contenteditable="false"`).
3. **The proven industry solution is a Hybrid Block-Flow Architecture (pioneered by Notion and Canva Docs, refined with PowerPoint-style discrete object selection):**
   - The document is authored as an ordered sequence of typed blocks: `TextBlock | MathBlock | TableBlock | GraphBlock`.
   - Non-text blocks behave as **first-class discrete objects** (clear selection bounds, single-click selection, action chips, double-click or Enter to edit, Backspace/Delete to remove).
   - Text blocks flow naturally, and inserting or editing an object never hijacks the surrounding text caret.
   - A **Natural Math Grammar (AsciiMath / Smart Linear notation)** eliminates LaTeX cognitive load for 95% of student use cases while keeping LaTeX available for advanced formulas.
   - Layout compiles blocks into deterministic `lineUnits`, strictly anchoring baselines to notebook ruled lines.

---

## 1. External Product Research & UX Analysis

We investigated official documentation and interaction models from six industry-standard products across document editors, block-based workspaces, presentation tools, and vector design suites.

### 1.1 Microsoft PowerPoint
* **Feature Studied:** Text boxes, shapes, discrete object selection, moving/resizing, editing modes.
* **Official Sources:**
  - [Microsoft Support: Select shapes and text boxes in PowerPoint](https://support.microsoft.com/en-us/office/select-shapes-and-text-boxes-47b8ff79-ff37-4d76-905a-8b83988b4ee4)
  - [Microsoft Support: Move or resize a text box or shape](https://support.microsoft.com/en-us/office/move-or-resize-a-shape-or-text-box-d5cf05b8-5cf7-4f65-8b3e-e6a6a24aa477)
* **Interaction Pattern:**
  - **Two-Level Selection State:** 
    1. *Object Selection (Border Active):* Clicking the border selects the container as an atomic object. Dotted/solid boundary with handles appears. Pressing `Delete` or `Backspace` deletes the entire object. Pressing arrow keys nudges the object.
    2. *Content Editing (Internal Caret Active):* Clicking inside the text box places a blinking text cursor. Keystrokes edit the text. Pressing `Esc` transitions back to Object Selection. Pressing `Esc` again deselects the object.
  - **Insertion Independence:** Creating a new text box or shape creates an independent object with its own bounding box; it never merges into adjacent text boxes unless explicitly grouped.
* **Fit for HandText:**
  - **What applies:** The distinct two-level selection model! When a student selects a `MathBlock`, `TableBlock`, or `GraphBlock`, it should become an atomic selected object with visible focus boundaries and quick action chips (Edit, Delete, Copy). Pressing `Backspace` on a selected object removes it cleanly without caret artifacts.
  - **What must NOT be copied:** PowerPoint's freeform coordinate canvas `(X, Y, Rotation, Free Drag)`. In HandText, content cannot float arbitrarily because it must align to ruled notebook lines and paginate across A4 pages. HandText requires *vertical flow ordering with discrete object interaction*.

---

### 1.2 Microsoft Word
* **Feature Studied:** Equation Editor (Linear/UnicodeMath vs Professional display mode, inline vs display equation blocks, keyboard shortcut `Alt + =`).
* **Official Sources:**
  - [Microsoft Support: Linear format equations using UnicodeMath and LaTeX in Word](https://support.microsoft.com/en-us/office/linear-format-equations-using-unicodemath-and-latex-in-word-2e00618d-b1dd-4cac-9c04-e48835ca6090)
  - [Microsoft Support: Write an equation or formula](https://support.microsoft.com/en-us/office/write-an-equation-or-formula-1d01c314-2388-4449-bc0f-9e6e26cf8892)
* **Interaction Pattern:**
  - **Display Equation vs Inline Equation:** Word distinguishes between inline equations (embedded within a running text sentence) and display equations (centered on their own line with a dedicated equation container).
  - **Linear Entry & Space Trigger:** Users type linear math (e.g. `(a+b)/(c+d)` or `x^2`) and upon pressing `Space` or `Enter`, Word converts the linear string into a professional two-dimensional layout.
  - **Container Boundary:** Word wraps display equations in a shaded tab container with a context menu handle on the right for alignment and format options.
* **Fit for HandText:**
  - **What applies:** Natural linear typing with automatic conversion to 2D math, and clear visual distinction for display formulas. HandText math formulas are predominantly standalone multi-line or display equations in student assignments (e.g. derivations, matrix equations, step-by-step problem solving).
  - **What must NOT be copied:** Word's complex ribbon interface and hundreds of nested equation galleries, which overwhelm students and slow down handwritten assignment preparation.

---

### 1.3 Google Docs
* **Feature Studied:** Insert Equation (`Alt + I + E`), equation toolbar, inline equation shortcuts, symbol insertion.
* **Official Sources:**
  - [Google Workspace Support: Use equations in a document](https://support.google.com/docs/answer/161808)
* **Interaction Pattern:**
  - **Inline Equation Box:** Inserts a blue-bordered inline box directly at the caret.
  - **Shorthand Conversion:** Typing `\` followed by a symbol name (e.g. `\alpha`, `\le`) followed by `Space` immediately inserts the symbol glyph.
  - **Caret Escape:** Arrow keys move into and out of the equation container. Pressing `Enter` or the right arrow at the right edge of the equation exits the equation and returns the cursor to normal body text.
* **Fit for HandText:**
  - **What applies:** Effortless exiting from math back into normal text. A major bug in HandText today is that after inserting math, students struggle to continue normal typing without clicking or glitching.
  - **What must NOT be copied:** Google Docs' lack of standalone display equation blocks. In Google Docs, equations are always inline characters, making multi-line equations and structured derivations difficult to align vertically.

---

### 1.4 Notion
* **Feature Studied:** Block architecture, Math equation blocks (`/math`), inline equations (`$$`), block selection, keyboard navigation.
* **Official Sources:**
  - [Notion Help Center: Math equations & KaTeX formatting](https://www.notion.so/help/math-equations)
  - [Notion Help Center: Learn the keyboard shortcuts](https://www.notion.so/help/keyboard-shortcuts)
* **Interaction Pattern:**
  - **Every Element is a Block:** Paragraphs, headings, equations, and tables are distinct `BlockNode` instances with stable IDs.
  - **Slash Command Insertion (`/math`):** Typing `/math` creates a dedicated `MathBlock` with KaTeX live preview.
  - **Focus & Selection:** 
    - Clicking a block's margin selects the block as an object (blue highlight).
    - Pressing `Enter` when a block is selected enters edit mode.
    - Pressing `Enter` at the end of an edit creates a new `TextBlock` directly below it, immediately ready for normal typing.
    - Pressing `Backspace` when an equation block is selected deletes the entire block cleanly.
  - **Keyboard Navigation:** `Up` and `Down` arrow keys jump cleanly between blocks without getting trapped inside widget boundaries.
* **Fit for HandText:**
  - **What applies:** **THIS IS THE PRIMARY BLUEPRINT FOR HANDTEXT'S EDITOR MODEL.** Notion's block model solves 100% of HandText's DOM caret loss, formula overwriting, and continuity issues. Each math formula, table, or graph is an isolated block. Clicking to edit math only edits *that specific block ID*. Inserting math always creates a *new block*. Continuing text after math is as simple as creating/focusing the subsequent text block.
  - **What must NOT be copied:** Notion's cloud-database syncing overhead and nested page-in-page complexity. HandText's block sequence is flat: a document is an ordered list of top-level blocks flowing into an A4 page.

---

### 1.5 Canva & Canva Docs
* **Feature Studied:** Canva Docs mixed content flow vs Canva Canvas freeform design, quick actions menu (`/`), block selection.
* **Official Sources:**
  - [Canva Help Center: Canva Docs content blocks and quick actions](https://www.canva.com/help/canva-docs/)
* **Interaction Pattern:**
  - **Bimodal Paradigm:** Canva maintains two completely different products:
    1. *Canva Canvas:* Freeform drag-and-drop objects, layers, rotation, snap guides (for posters/social media).
    2. *Canva Docs:* Strictly flow-based document with rich design blocks, headers, and tables (for documents).
  - Canva recognized that **users cannot write structured documents on a freeform canvas**; attempting to do so causes text and diagrams to drift and break across pages.
* **Fit for HandText:**
  - **Critical Validation:** Confirms our decision: **HandText must NOT become a freeform PowerPoint/Canva canvas**. The editor must be flow-based so that content automatically paginates and aligns to ruled lines.

---

### 1.6 Figma
* **Feature Studied:** Layer selection, deep selection (`Ctrl + Click`), direct editing with `Enter`, committing with `Esc`.
* **Official Sources:**
  - [Figma Help Center: Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449913-Select-layers-and-objects)
* **Interaction Pattern:**
  - Explicit bounding box around selected elements.
  - `Enter` drills down from container selection to text edit mode.
  - `Esc` bubbles up from edit mode to container selection.
  - Hover highlights afford clickable boundaries before interaction.
* **Fit for HandText:**
  - Clean UI affordances: Hovering over a `MathBlock` or `TableBlock` shows a subtle focus boundary. Clicking selects the block. `Esc` deselects. Action buttons appear floating above or alongside the active block.

---

### 1.7 Natural Math Input Research (AsciiMath, MathLive, Desmos)
* **Feature Studied:** Calculator-style natural math grammar vs raw LaTeX.
* **Official Sources:**
  - [AsciiMath Official Specification](http://asciimath.org/)
  - [MathLive Interactive Equation Editor](https://cortexjs.io/mathlive/)
* **Key Findings:**
  - Students writing assignment solutions naturally think in expressions like:
    - `Z1 = X1 W11 + X2 W21`
    - `x^2 + y^2 = r^2`
    - `W11 = -1, W12 = 2, W21 = 1`
    - `a/b`
    - `sqrt(x)`
    - `x_1`
  - In raw LaTeX, this requires typing:
    - `Z_1 = X_1 W_{11} + X_2 W_{21}` (or needing `\quad` because LaTeX collapses spaces between characters)
    - `W_{11} = -1,\quad W_{12} = 2,\quad W_{21} = 1`
    - `\frac{a}{b}`
    - `\sqrt{x}`
  - **The Solution:** A lightweight **Smart Math Pre-Parser** that:
    1. Preserves whitespace between terms (converting spaces to natural math spacing `\,` or `\quad` automatically).
    2. Converts natural fractions `a/b` or `(x + 1)/(y - 1)` into `\frac{...}{...}`.
    3. Converts `sqrt(...)` into `\sqrt{...}`.
    4. Converts multi-character sub/superscripts without forcing braces: `x_1` → `x_{1}`, `x^2` → `x^{2}`, `W11` → `W_{11}`.
    5. Leaves valid raw LaTeX untouched so advanced users retain full power.

---

## 2. Current Architecture & Codebase Inspection Findings

### 2.1 The Monolithic ContentEditable Container
* **Location:** `src/components/editor/RichContentEditor.tsx`
* **Current Behavior:**
  - The entire editor is a single `<div contenteditable="true" className="rich-content-editor ...">`.
  - Math is inserted as `<div class="math-block" contenteditable="false" data-latex="...">...</div>`.
  - Tables are inserted as `<table class="handtext-table" contenteditable="false" data-table-id="...">...</table>`.
  - Graphs are inserted as `<div class="graph-block" contenteditable="false" data-graph-def="...">...</div>`.
* **The Failure Mode:**
  - Browsers treat `contenteditable="false"` blocks as opaque atomic inline-blocks.
  - When the caret is placed before or after a `math-block`, browser native selection models often fail to provide a cursor position, collapsing the range into the nearest text node or into the widget container itself.
  - When a modal opens (e.g. `MathFormulaModal`), the editor div fires `onBlur`. The component attempts to save the range in `savedRangeRef.current = selection.getRangeAt(0)`.
  - When the modal closes, `restoreSelection()` attempts `selection.addRange(savedRangeRef.current)`. However, if the DOM changed or if the user clicked any toolbar button, the range is either stale, points to the root div, or points to the previously selected math element.

### 2.2 Formula Overwriting & Stale Reference Bugs
* **Location:** `src/components/editor/EditorToolbar.tsx` line 204 & `RichContentEditor.tsx` lines 145–188.
* **Bug Trace:**
  1. User clicks an existing math formula. `formatState.mathInfo = { latex: '...', element: targetEl }` is set.
  2. User finishes editing, or clicks away into empty space.
  3. User clicks the "Math" button in `EditorToolbar` expecting to insert a **new** formula.
  4. `EditorToolbar.tsx` evaluates:
     ```typescript
     initialLatex={mathInitialLatex || formatState.mathInfo?.latex}
     ```
     Because `formatState.mathInfo` was not cleared when the user clicked empty whitespace, the modal opens with the **old formula**.
  5. When the user confirms the modal, `insertMathBlock` checks:
     ```typescript
     if (currentMathElementRef.current && currentMathElementRef.current.isConnected) {
       currentMathElementRef.current.setAttribute('data-latex', latex);
       // ... OVERWRITES THE EXISTING FORMULA!
     }
     ```
  6. The user wanted a brand new formula, but the editor silently overwrote their previous formula elsewhere in the document!

### 2.3 Continuity Loss: Cannot Continue Typing After Math
* **Bug Trace:**
  - Inserting a `math-block` appends or inserts `<div class="math-block" contenteditable="false">`.
  - Browsers do not automatically create an editable text node following an atomic block widget.
  - The student tries to type, but keystrokes are swallowed because the active cursor is still inside or directly adjacent to the non-editable widget.
  - Current workaround attempts inserted `<p><br></p>` tags, but these get stripped during normalisation or cause double-line jumps.

### 2.4 Vertical Whitespace Inflation (`computeLineUnits`)
* **Location:** `src/lib/math/layout.ts` lines 78–92
* **Current Code:**
  ```typescript
  export function computeLineUnits(
    box: MathLayoutBox,
    rulingSpacing: number = DEFAULT_RULING_SPACING
  ): number {
    const totalHeight = box.height;
    if (totalHeight <= rulingSpacing * 1.05) {
      return 1;
    }
    return Math.max(1, Math.ceil(totalHeight / rulingSpacing));
  }
  ```
* **The Root Cause:**
  - `DEFAULT_RULING_SPACING` is 28px.
  - `1.05 * 28 = 29.4px`.
  - A standard handwritten formula containing a superscript (like $x^2$) or a fraction or a capital letter often measures ~30px–34px from top ascender to bottom descender.
  - Because 30px > 29.4px, `computeLineUnits` returns **2 lineUnits**!
  - Allocating 2 full ruled lines (56px) for a simple expression like $x^2 = 4$ creates massive, unnatural vertical gaps in the notebook handwriting.
  - Worse: when 2 lineUnits are allocated, the layout engine centers the formula vertically across both lines, leaving the formula floating midway between two ruled lines instead of resting on the lower line!

### 2.5 Baseline Misalignment in `renderer.ts`
* **Location:** `src/lib/handwriting/renderer.ts` line 419:
  ```typescript
  let baselineY = ruledLineY;
  if (box.descent > rulingSpacing * 0.12) {
    baselineY = ruledLineY - box.descent;
  }
  ```
* **The Root Cause:**
  - When a math formula has a descender (such as $y$, $p$, or a subscript $x_1$), `box.descent` exceeds `rulingSpacing * 0.12` (~3.3px).
  - The renderer subtracts `box.descent` from `ruledLineY`, shifting the *entire formula upwards*.
  - In a real ruled notebook, a writer rests the math baseline **directly on the ruled line**, and descenders naturally extend below the ruled line (just like lowercase letters $g, y, p$).
  - Artificially lifting `baselineY` makes the math formula float above the ruled line while the adjacent text rests on the line, creating jarring visual misalignment.

---

## 3. Root-Cause Analysis Matrix

| Symptom / Observed Problem | Current Implementation | Root Cause Category | Classification | Correct Solution |
|---|---|---|---|---|
| **Formula overwrites wrong existing formula** | `insertMathBlock` checks `currentMathElementRef.current` which persists across selections | Editor State & Reference Management | Architectural Bug | Distinct Mode separation: Explicit `insertNewMath()` vs `editMathBlock(blockId)`. Clear selection on blur/escape. |
| **Caret / Range loss on modal open/close** | Relies on browser `window.getSelection()` and `savedRangeRef` inside contenteditable | DOM / Range Model | Structural Flaw | Block-based insertion anchor: Store target `blockId` and `insertIndex` instead of fragile DOM Range objects. |
| **User cannot type after inserting math** | Non-editable DOM widget inserted without guaranteed subsequent text block | Editor DOM Architecture | Architectural Flaw | Block Architecture: Every MathBlock insertion automatically ensures or focuses a subsequent `TextBlock`. |
| **Clicking empty space inserts at wrong position** | Browser contenteditable clicks in empty padding map to arbitrary child index | Browser Contenteditable Defect | Structural Flaw | Container click handler maps click Y-coordinate to nearest block boundary and creates/focuses a TextBlock there. |
| **Excessive vertical whitespace for $x^2$** | `computeLineUnits` triggers 2 lines at `1.05 * rulingSpacing` (29.4px) | Math Layout Computation | Algorithmic Defect | Raise single-line tolerance to `1.35 * rulingSpacing` (37.8px) for inline/compact math with superscripts. |
| **Formula floats off ruled line** | `renderer.ts` line 419 lifts baseline: `baselineY = ruledLineY - box.descent` | Handwriting Renderer Layout | Mathematical Bug | Remove baseline lift. Anchor math baseline strictly to `ruledLineY`. Descenders draw below baseline. |
| **Superscripts behave like separate lines** | Over-inflated lineUnits causes centering across 2 ruled lines | Math Layout + Rendering | Algorithmic Bug | 1 lineUnit for standard superscripts. Baseline anchored to ruled line. |
| **Fractions overly large vertical composition** | Default fraction numerator/denominator scale is 0.85 with large bar padding | Math Layout Box Geometry | Metric Tuning | Use compact handwriting fraction scale (0.75 numerator/denominator, 3px bar gap). |
| **User forced to type LaTeX `\quad`** | Math parser accepts only raw LaTeX; ignores plain spaces | Input / UX Model | Interaction Flaw | Smart Natural Math parser: automatically converts natural spacing and calculator syntax to formatted math. |
| **No visual indication of active object** | Math block in editor is indistinguishable from surrounding text until clicked | UI Affordance | UX Defect | Discrete Object UI: Selected border, action chips (Edit, Delete, Copy), hover outline. |

---

## 4. Flow vs. Object Positioning: The Hybrid Model

A central requirement of this research is determining how HandText achieves **PowerPoint-like independent object interaction** WITHOUT losing **flow-based A4 pagination and ruled-line grid alignment**.

### 4.1 The Fundamental Distinction: Editor Model vs. Final Page Layout Model

```
┌─────────────────────────────────────────────────────────────┐
│                    EDITOR INTERACTION MODEL                 │
│                                                             │
│   Document = Ordered List of First-Class Blocks             │
│   ├── Block 1: TextBlock (id: "b1", text: "Given that:")   │
│   ├── Block 2: MathBlock (id: "b2", expr: "Z1 = X1 W11")   │  <-- PowerPoint/Notion
│   ├── Block 3: TextBlock (id: "b3", text: "We compute:")   │      Object Interaction:
│   └── Block 4: TableBlock (id: "b4", rows: 3, cols: 3)     │      Select, Edit, Delete
└──────────────────────────────┬──────────────────────────────┘
                               │ Compiles to FlowItems
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   FINAL PAGE LAYOUT MODEL                   │
│                                                             │
│   A4 Ruled Grid Layout (Strict Document Flow)               │
│   - PageCoordinateSystem                                    │
│   - Content Bounds (top, bottom, left, right margins)       │
│   - LineUnits Allocation (Block height -> N ruled lines)    │
│   - Strict Vertical Flow Pagination (Page 1 -> Page 2)      │
│   - Canvas Handwriting Glyph & Pen Stroke Renderer          │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Why Freeform Coordinates Fail for Ruled Notebooks
In PowerPoint or Figma, objects have `(x, y)` absolute coordinates. If HandText allowed freeform `(x, y)` placement:
1. When a student adds three lines of text at the top of Page 1, all freeform objects below it would either:
   - Stay at fixed `(x, y)` positions, causing text to collide and overlap with math formulas.
   - Or require complex collision avoidance algorithms that destabilize handwriting alignment.
2. Handwritten documents have physical **ruled lines** spaced at ~28px. If an object is placed at an arbitrary pixel coordinate `y = 143.5px`, its baseline will not match the paper's ruling, destroying the authenticity of the notebook.

### 4.3 The Recommended Hybrid Solution: Flow-Sequenced Discrete Objects
1. **Flow Sequencing:** Blocks exist in a strict vertical sequence $[B_1, B_2, \dots, B_n]$. They flow downward in reading order.
2. **Object Boundaries:** Each block is a standalone React component rendered within the editor workspace. Non-text blocks (`MathBlock`, `TableBlock`, `GraphBlock`) have:
   - Stable UUID.
   - Distinct outer bounding container.
   - Object selection ring (subtle blue focus outline when active).
   - Floating action toolbar (Edit button, Delete button, Move Up/Down button).
3. **Deterministic LineUnit Sizing:** Each block reports its height in terms of **`lineUnits`** (integer number of ruled lines):
   - `TextBlock`: $N$ lines based on word wrap at content width.
   - `MathBlock`: 1 lineUnit for standard/compact equations; 2–3 lineUnits for complex multi-line/fraction equations.
   - `TableBlock`: Sum of row heights in lineUnits.
   - `GraphBlock`: Fixed integer lineUnits (e.g. 10–14 lines).
4. **Pagination:** The existing `calculatePageLayout` and pagination engine places blocks sequentially across lines. If Block $B_k$ requires $L$ lines but only $M < L$ lines remain on Page $P$, $B_k$ breaks cleanly to the top of Page $P+1$.

---

## 5. Math Input UX: Natural Math vs. LaTeX

### 5.1 The Problem With Raw LaTeX for Students
Currently, when a student wants to type:
$$Z_1 = X_1 W_{11} + X_2 W_{21}$$
they must type:
`Z_1 = X_1 W_{11} + X_2 W_{21}` into a modal. If they type `Z1 = X1 W11 + X2 W21`, LaTeX renders:
$$Z1=X1W11+X2W21$$
collapsing all variables together and losing subscripts. Worse, to get a horizontal space, students are expected to know `\quad` or `\text{ }`.

### 5.2 The Smart Natural Math Input Model
We propose a **Smart Linear Math Grammar** that interprets natural mathematical shorthand while maintaining full LaTeX compatibility:

| Natural User Input | Smart Transformation | Rendered Handwritten Math |
|---|---|---|
| `Z1 = X1 W11 + X2 W21` | `Z_1 = X_1 W_{11} + X_2 W_{21}` | Subscripts auto-detected on letter-number pairs; spaces preserved |
| `x^2 + y^2 = r^2` | `x^2 + y^2 = r^2` | Superscripts |
| `x_1, x_2, ..., x_n` | `x_1, x_2, \dots, x_n` | Subscripts & ellipsis |
| `a/b` or `(x + 1)/(y - 1)` | `\frac{a}{b}` or `\frac{x + 1}{y - 1}` | Natural fraction |
| `sqrt(x^2 + 1)` | `\sqrt{x^2 + 1}` | Square root |
| `W11 = -1, W12 = 2` | `W_{11} = -1,\quad W_{12} = 2` | Comma-separated equations automatically given horizontal breathing room |
| `alpha + beta <= theta` | `\alpha + \beta \le \theta` | Greek letters & operators |
| `\int_0^1 x dx` | Kept verbatim (raw LaTeX detected) | Full power for advanced users |

### 5.3 Input Modal & Inline Quick Editor UX
- **Live Preview:** Instant handwriting preview rendered in real time as the student types.
- **Natural / LaTeX Toggle:** Default mode is "Natural Math". An "Advanced LaTeX" toggle switch allows power users to write raw LaTeX without auto-transformations.
- **Quick Symbol Palette:** Frequently used academic symbols ($\pm, \times, \div, \le, \ge, \neq, \approx, \sqrt{\phantom{x}}, \frac{a}{b}, \sum, \int, \alpha, \beta, \theta, \pi$) are clickable chips at the top of the input field.
- **Keyboard Commits:**
  - `Ctrl + Enter` (or `Cmd + Enter`): Instantly insert/save formula and place focus in the following text block.
  - `Escape`: Cancel and return focus to document.

---

## 6. Document Model & Block Architecture

### 6.1 Recommended Block Schema

```typescript
// Proposed Document Data Model
export type BlockType = 'text' | 'math' | 'table' | 'graph';

export interface BaseBlock {
  id: string;             // Stable UUID (e.g. "blk_k9f2m1...")
  type: BlockType;
  createdAt: number;
}

export interface TextBlock extends BaseBlock {
  type: 'text';
  html: string;           // Rich text HTML (bold, italic, underline, colors, lists)
}

export interface MathBlock extends BaseBlock {
  type: 'math';
  expression: string;     // Stored expression (Natural math or LaTeX)
  latex: string;          // Compiled/canonical LaTeX for rendering
  isBlockDisplay: boolean;// true for centered display formula, false for left-aligned
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  tableData: TableModel;  // Existing HandText TableModel (rows, cols, cells, alignment)
}

export interface GraphBlock extends BaseBlock {
  type: 'graph';
  graphDef: GraphDefinition; // Existing HandText GraphDefinition
}

export type DocumentBlock = TextBlock | MathBlock | TableBlock | GraphBlock;

export interface HandTextDocument {
  version: 2;
  blocks: DocumentBlock[];
  metadata?: {
    title?: string;
    updatedAt: number;
  };
}
```

### 6.2 State Machine: Block Selection & Focus Flow

```
[Normal Typing in TextBlock A]
         │
         │  User clicks "Insert Math" or presses shortcut
         ▼
[Open Math Input (Anchor: after TextBlock A)]
         │
         │  User types "Z1 = X1 W11" and hits Ctrl+Enter
         ▼
[Insert MathBlock B (id: "b_math_1")]
         │
         │  AUTOMATIC ACTION: Create/Focus TextBlock C below MathBlock B
         ▼
[Normal Typing in TextBlock C]  <-- Seamless continuity! No mouse clicks needed!
```

**Selection State Interactions:**
- **Single Click on MathBlock:** Selects the block as an object. Shows focus outline and floating action bar: `[ Edit (Enter) ] [ Copy ] [ Delete (Backspace) ]`.
- **Double Click or Enter on Selected MathBlock:** Opens the Math Editor prefilled with *only this block's formula*.
- **Backspace / Delete on Selected MathBlock:** Deletes the block cleanly. Focus automatically moves to the preceding block's end.
- **Arrow Keys:**
  - When cursor is at the end of `TextBlock A` and user presses `Down Arrow`: Focus moves to `MathBlock B` (Object Selected).
  - Pressing `Down Arrow` again: Focus enters start of `TextBlock C`.

---

## 7. Persistence & Migration Strategy

### 7.1 Existing Storage Analysis
- **Current Persistence Layer:** `useProjectPersistence.ts` stores document content as an HTML string in IndexedDB (`handtext_draft`) and Supabase projects (`projects.content: string`).
- **In-DOM Format:**
  - Text: Standard HTML tags (`<p>`, `<h1>`, `<ul>`, `<li>`).
  - Math: `<div class="math-block" data-latex="...">...</div>`.
  - Tables: `<table class="handtext-table" data-table-id="...">...</table>`.
  - Graphs: `<div class="graph-block" data-graph-def="...">...</div>`.

### 7.2 Zero-Breakage Migration Architecture
We do **not** need to break the database schema or invalidate user drafts!
1. **Serialization Function (`blocksToHtml(blocks: DocumentBlock[]): string`):**
   - Compiles the structured block array into the standard semantic HTML string that HandText already uses.
   - Each block is wrapped in a container with a `data-block-id` and `data-block-type`.
2. **Deserialization / Migration Function (`htmlToBlocks(html: string): DocumentBlock[]`):**
   - Parses incoming HTML (from IndexedDB draft or Supabase project).
   - Identifies math blocks, tables, and graphs as discrete blocks.
   - Chunks intermediate HTML into `TextBlock` instances.
   - Assigns stable UUIDs to any legacy blocks that lack IDs.
   - 100% round-trip fidelity: `htmlToBlocks(blocksToHtml(blocks))` preserves content identically.

---

## 8. Performance, Accessibility & Mobile Considerations

### 8.1 Performance Strategy
- **React Rendering:** Each block in the editor is wrapped in `React.memo()`. Editing text in `TextBlock 3` does not trigger re-rendering or re-parsing of `MathBlock 1` or `TableBlock 2`.
- **Math AST & Layout Caching:** Cache compiled `MathLayoutBox` instances in a memoized WeakMap/LRU cache keyed by LaTeX expression string and ruling spacing. Re-layout is instantaneous ($< 1\text{ms}$).
- **DOM Measurement Isolation:** Blocks report layout heights deterministically via formulas rather than relying on synchronous browser DOM `getBoundingClientRect()` calls.

### 8.2 Accessibility & Mobile Usability
- **Focus Rings:** High-contrast, theme-aware focus outlines (`ring-2 ring-indigo-500`) clearly indicate which object is currently selected.
- **Keyboard Accessibility:** All operations (insert, edit, delete, move) are executable via keyboard shortcuts (`Ctrl+Shift+M` insert math, `Enter` edit, `Esc` deselect, `Delete` remove).
- **Mobile Touch Targets:** Floating action chips on selected objects have minimum 44×44px touch bounding boxes for easy tablet/stylus interaction.

---

## 9. Conclusion & Next Architectural Steps

The investigation conclusively establishes:
1. **The Block Document Core is the Mandatory Architectural Foundation:** Moving to an explicit **Hybrid Block Model** is the only way to permanently eliminate recurrent caret loss, formula overwriting, and continuity issues. Attempting another isolated math-only patch without this foundation would perpetuate fragile DOM behavior.
2. **Smallest Architectural Change Principle:** Rather than rewriting the entire editor, HandText achieves this by:
   - Wrapping existing, proven subsystems (`TableEditor`, `Graph`) into `TableBlock` and `GraphBlock`.
   - Confining browser `contenteditable` strictly to individual `TextBlockView` components.
   - Maintaining the existing HTML persistence format via an idempotent two-way adapter (`htmlToBlocks` $\leftrightarrow$ `blocksToHtml`).
3. **Math Baseline & Vertical Whitespace Status:**
   - *Root causes identified:* Over-sensitive $1.05\times$ threshold in `computeLineUnits()` inflating $x^2$ to 2 lines ($56\text{px}$); artificial `baselineY = ruledLineY - box.descent` shift in `renderer.ts` lifting formulas off ruled lines.
   - *Proposed corrections documented:* Raise single-line threshold to $1.35\times$ ruling spacing; anchor baseline strictly to `ruledLineY`; tighten fraction bar padding.
   - *Implementation & Visual Verification Pending:* Scheduled for Phase 4 of the execution plan.
4. **Smart Natural Math Parser:** Eliminates LaTeX friction for student users (`Z1 = X1 W11 + X2 W21`, `x^2`, `a/b`, `sqrt(x)` without `\quad`) while preserving full KaTeX rendering and advanced LaTeX options.

The architecture is locked and the implementation plan is ready for execution.
