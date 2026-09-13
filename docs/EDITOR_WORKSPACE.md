# HandText — Editor Workspace Architecture

> **Three-Column Workstation UX, Viewport Mechanics, and Component Hierarchy**  
> *Target Audience:* Frontend Engineers, UX Designers, Core Contributors  
> *Last Updated:* September 2026  
> *Document Status:* Active & Canonical

---

## 1. Workstation Design Philosophy

Early iterations of document editors often suffer from "runaway viewport growth": as the user types thousands of words or generates high-resolution canvas sheets, the outer browser window expands vertically, causing toolbars, format controls, and inspector panels to scroll out of view.

HandText solves this by implementing a **Fixed-Viewport, Multi-Column Workstation Layout**. The outer container is locked strictly to 100% of the browser viewport (`h-screen overflow-hidden`), while each major functional pillar scrolls independently within its own constrained container.

---

## 2. Desktop Three-Column Grid Hierarchy `[CURRENT]`

On screens $\ge 1024\text{px}$ (`lg` breakpoint), the workspace arranges into three specialized columns:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STICKY HEADER (56px fixed height): [Back] [Title] [Sync State Pill] [Undo/Redo] [Counter] [Save] │
├───────────────────────────────┬──────────────────────────────────┬───────────────────────────────┤
│ COLUMN 1: CONTENT EDITOR      │ COLUMN 2: PAGE PREVIEW           │ COLUMN 3: DESIGN INSPECTOR    │
│ Class: flex-1 min-h-0         │ Class: w-[520px] shrink-0        │ Class: w-[380px] shrink-0     │
│ Scroll: Independent           │ Scroll: Independent              │ Scroll: Independent           │
│                               │                                  │                               │
│ - Assignment Mode checkbox    │ - Preview toolbar                │ - Template preset picker      │
│ - Question prompt textarea    │   (Write on page, Prev/Next)     │ - Paper kind & background     │
│ - Sticky EditorToolbar        │ - Scrollable viewport card       │ - Ruling type, color, opacity │
│ - RichContentEditor           │ - HTML5 Canvas 2D (Live Preview) │ - Margin rule & positions     │
│   (Semantic ContentEditable)  │ - Interactive write-on-page      │ - Handwriting personality     │
│ - FloatingFormatBubble        │   layer with red line tracker    │ - Slant, jitter, speed, width │
│ - Collapsible AiAssistant     │                                  │ - Header/Footer bands config  │
└───────────────────────────────┴──────────────────────────────────┴───────────────────────────────┘
```

```css
/* Grid layout container definition */
.workspace-grid {
  display: grid;
  width: 100%;
  max-width: 1600px;
  flex: 1 1 0%;
  min-height: 0;
  gap: 1.5rem;
  padding: 1rem;
  overflow: hidden;
  grid-template-columns: minmax(0, 1fr) 520px 380px;
}
```

---

## 3. Column Breakdown

### Column 1: Content Editor (`flex-1 min-h-0`)
The primary authoring environment:
- **Assignment Mode**: A checkbox toggle at the top. When checked, reveals an academic question textarea (`min-h-16 max-h-24`) that renders the assignment prompt at the top of the first page.
- **`EditorToolbar.tsx`**: Pinned directly above the editor. Provides block-level formatting actions:
  - Headings: H1, H2 toggles.
  - Lists: Bulleted (`<ul>`) and Numbered (`<ol>`) lists.
  - Blockquote (`<blockquote>`) and Divider line (`<hr>`).
  - Table Insertion Popover: Allows selecting custom row and column counts (e.g., $3 \times 3$) and inserts a clean semantic `<table>`.
  - Clear Formatting button.
- **`RichContentEditor.tsx`**:
  - Encapsulates the `contenteditable` container.
  - Sanitizes pasted text to prevent style injection.
  - Communicates changes via `onChange(htmlString)` and emits active formatting flags via `onFormatChange(state)`.
- **`FloatingFormatBubble.tsx`**:
  - Contextual floating menu rendered in a portal directly above selected text ranges.
  - Renders inline character formatting: Bold, Italic, Underline, Scale dropdown (85%, 100%, 120%, 140%), Student Ink colors, and Fluorescent Highlighters.
- **`AiAssistant.tsx`**: Collapsible bottom utility for generating, expanding, or summarizing student answers.

---

### Column 2: Live Page Preview (`w-[520px] shrink-0`)
Provides instant, continuous visual feedback of how text flows onto the physical page:
- **Preview Header Controls**:
  - **"Write on page" Toggle**: Switches into an interactive direct-input mode.
  - **Pagination Controls**: If text spans multiple pages, provides `<` (Previous) and `>` (Next) buttons along with page index display (`Page 1 of 3`).
  - **Status Indicator**: Displays "Updating…" during background render passes.
- **Viewport Card (`Card overflow-y-auto`)**:
  - Constrains the physical page aspect ratio (1240 × 1754 for A4).
  - Renders the active `LayoutPage` onto an HTML5 Canvas using `renderPageToCanvas()`.
- **Interactive "Write on Page" Mode**:
  - Overlays a transparent `textarea` aligned pixel-perfectly with the physical paper's writable region (`writingArea()`).
  - **Ruled-Line Guide**: Tracks pointer coordinates, calculates the active ruled line index via `getLineIndexAtPageY()`, and renders a crisp primary line with a red floating badge (`Line 4`) indicating exact pen placement.

---

### Column 3: Design Inspector (`w-[380px] shrink-0`)
The configuration hub for physical stationery and handwriting physics:
- **Templates**: Instant one-click presets (e.g., University Assignment, Exam Answer, Class Notes, Cornell Notes).
- **Paper & Stationery Accordion**:
  - Paper styles: Plain, Ruled, Double Ruled, Narrow, Grid, Graph, Dotted, Exam, Cornell, Bordered.
  - Paper tones: White, Off-white, Cream, Light yellow, Notebook white, Aged paper.
  - Texture levels: Off, Low, Medium, High.
  - Margin rules: Color, toggle, and left offset (px).
  - Horizontal rulings: Color, opacity (0–1), and line thickness.
- **Handwriting Personality Accordion**:
  - Presets: Neat Student, Fast Exam Writing, Casual Notes, Exam Style, Natural Notes, Custom.
  - Physics sliders: Slant (-10° to +15°), Baseline variation (0–5px), Character variation (0–1), Slant variation (0–8°), Imperfection (0–1), Writing speed (0–1), Pen pressure (0–1), Pen width (0.5–4.0px), Compactness (0.85–1.1x).
- **Ink Palette**: Classic Blue, Dark Blue, Royal Blue, Black, Dark Black, Red, Green, and Custom Hex picker.
- **Academic Header & Footer Furniture**:
  - Enable/disable toggles for header and footer bands.
  - Height adjustments (quantized to ruling spacing intervals).
  - Scope rules (`all`, `first`, `last`).
  - Slots: Left, Center, Right across rows.
  - Elements: Student Name, Enrollment Number, Roll Number, Subject, Course Code, College, Teacher Name, Assignment Title, Date, Signature, and Dynamic Page Numbering (`Page n`, `n / total`, etc.).

---

## 4. Responsive Behavior (< 1024px Viewports)

On mobile devices and tablet viewports where three simultaneous columns cannot fit:
1. The three-column CSS grid collapses.
2. A sticky top tab bar appears:
   ```html
   <div role="tablist" class="flex lg:hidden">
     <button>Content</button>
     <button>Preview</button>
     <button>Design</button>
   </div>
   ```
3. Switching tabs toggles visibility of the active column while keeping background render states and drafts fully intact.

---

## 5. Sticky Header & Action Bar Architecture

The global header remains permanently pinned at the top:
- **Navigation**: Back arrow returning to `/dashboard`.
- **Project Title Input**: Inline editable input with hover border; updates local and cloud project name.
- **Save State Pill**:
  - `saving-cloud`: Animated spinner with *"Saving…"*.
  - `saved-locally`: Green checkmark with *"Saved locally · Unsaved to cloud"*.
  - `saved`: Green checkmark with *"Saved"*.
  - `error`: Destructive cloud icon with *"Not saved to cloud"*.
- **History Controls**: Native Undo (<kbd>Ctrl</kbd>+<kbd>Z</kbd>) and Redo (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>) using an immutable snapshot stack.
- **Counter Badge**: Real-time word count and estimated page count (`340 words · 2 pages · 48 pages left`).
- **Save Button**: Secondary button triggering explicit cloud synchronization.
- **Generate CTA**: Primary button triggering full document generation and routing to the Result View.
