# Phase M2-P4 — Answer-Sheet Layout / Question Margin System: Architecture

> *GSD Architecture Document — Data Models, Layout Geometry, Pipeline Integration, and Persistence*  
> *Phase:* M2-P4 (Answer-Sheet Layout / Question Margin System)  
> *Date:* September 2026  
> *Status:* Ready for Implementation Planning  

---

## 1. System Architecture Overview

The Answer-Sheet Layout / Question Margin system integrates across five layers of HandText's architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Document Model & Serialization Layer                                │
│    BaseBlock.marginMarker? ─── data-margin-marker ─── blocksToHtml    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 2. Parsing Layer (parse.ts)                                            │
│    Extracts marginMarker from HTML / block attributes → Block.marginMarker│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 3. Layout Engine (layout.ts)                                           │
│    Computes margin column geometry:                                    │
│      marginMarkerLeft = 18px                                           │
│      marginRuleX = settings.page.margin.position (default ~72px)       │
│      contentLeft = marginRuleX + 16px                                  │
│    First line of block carries FlowLine/FlowMath/FlowTable.marginMarker│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 4. Handwriting Canvas Renderer (renderer.ts)                           │
│    Draws vertical red margin rule at marginRuleX                       │
│    Renders handwritten marker text in margin zone at first baseline    │
│    Renders answer content in main area starting at contentLeft         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 5. LEFT Editor UX (RichContentEditor.tsx & Gutter Pill)                │
│    Visual gutter chip on block hover/focus with quick presets & edit   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model Specification

### A. Core Document Block Extension (`src/types/document.ts`)

Extend `BaseBlock` with an optional `marginMarker`:

```typescript
export interface MarginMarker {
  type: "question" | "answer" | "subquestion" | "marks" | "custom";
  text: string;
  color?: string | undefined; // optional custom ink color override
}

export interface BaseBlock {
  id: string;
  type: BlockType;
  createdAt: number;
  marginMarker?: MarginMarker | undefined;
}
```

### B. Handwriting Parse Block Extension (`src/lib/handwriting/parse.ts`)

```typescript
export interface Block {
  kind: BlockKind;
  text: string;
  segs?: Seg[] | undefined;
  marker?: string | undefined; // bullet or standard list number
  marginMarker?: MarginMarker | undefined; // NEW: Question/Answer margin marker
  math?: MathBlockData | undefined;
  table?: TableData | undefined;
  graph?: GraphBlockData | undefined;
}
```

### C. HTML Serialization Contract (`src/lib/editor/blockSerialization.ts`)

To ensure 100% round-trip idempotency and zero data loss across drafts and Supabase sync:

1. **Paragraphs / Headings (TextBlock):**
   ```html
   <p data-margin-marker="Q1" data-margin-type="question">Introduction: A data warehouse is...</p>
   ```
2. **Math Blocks:**
   ```html
   <div class="math-block" data-block-id="math_1" data-margin-marker="Ans" data-margin-type="answer" data-latex="Z_1 = X_1 W_{11} + X_2 W_{21}">...</div>
   ```
3. **Table Blocks:**
   ```html
   <div class="table-block" data-block-id="tbl_1" data-margin-marker="Q2" data-margin-type="question"><table>...</table></div>
   ```
4. **Graph Blocks:**
   ```html
   <div class="graph-block" data-block-id="grp_1" data-margin-marker="Fig 1" data-margin-type="custom" data-graph-definition="...">...</div>
   ```

---

## 3. Layout Geometry & Coordinate Model (`src/lib/handwriting/layout.ts`)

### A. Coordinate Calculations
In `activeCoordinateSystem` in `src/lib/handwriting/layout.ts`:
```typescript
const isAnswerMarginEnabled = settings.page.answerMargin?.enabled ?? settings.page.margin.enabled;
const marginWidth = settings.page.answerMargin?.width ?? (settings.page.margin.position || 72);

// The vertical ruling divider line
const marginRuleX = isAnswerMarginEnabled ? Math.max(48, Math.min(120, marginWidth)) : 0;

// The margin marker starts after left page padding
const marginMarkerLeft = Math.max(14, settings.marginLeft * 0.4);
const marginMarkerMaxWidth = Math.max(24, marginRuleX - marginMarkerLeft - 8);

// Content Left: strictly to the right of the margin divider
const contentLeft = isAnswerMarginEnabled ? marginRuleX + 16 : Math.max(settings.marginLeft, 48);
const contentRight = w - Math.max(48, settings.marginRight);
```

### B. Flow Representation & Baseline Binding
In `src/lib/handwriting/layout.ts`:
- Extend `FlowLine`, `FlowMathBlock`, `FlowTableRow`, and `FlowGraphBlock` with `marginMarker?: MarginMarker`.
- When converting a `Block` into flow items:
  1. Only the **first** flow item of the block receives `marginMarker = block.marginMarker`.
  2. All subsequent wrapped lines or subsequent rows of the same block have `marginMarker = undefined`.
  3. When the first item is laid out at `lineIndex` on a page, its baseline is:
     $$y = \text{getBaseline}(\text{coordinates}, \text{lineIndex})$$
  4. The question marker is anchored to this exact $y$ coordinate.

### C. Multi-Page Overflow Rule
- If a block spans across multiple pages (e.g. Page 1 $\rightarrow$ Page 2):
  - Page 1 contains line 0 $\rightarrow$ carries `marginMarker` $\rightarrow$ rendered in Page 1 margin.
  - Page 2 contains continuation line $k$ $\rightarrow$ `marginMarker` is `undefined` $\rightarrow$ Page 2 margin remains clean and uncluttered.
  - Zero floating markers. Zero duplicate markers.

---

## 4. Handwriting Canvas Rendering (`src/lib/handwriting/renderer.ts`)

In `renderPages` and `renderPageToCanvas`:
1. **Vertical Divider Rule:**
   - Painted during `paintPaper` or immediately prior to placements:
   ```typescript
   if (coordinates.marginRuleX > 0) {
     ctx.save();
     ctx.strokeStyle = settings.page.margin.color || "#e11d48"; // classic exam red rule
     ctx.lineWidth = settings.page.margin.thickness || 1.2;
     ctx.beginPath();
     ctx.moveTo(coordinates.marginRuleX, coordinates.contentTop);
     ctx.lineTo(coordinates.marginRuleX, coordinates.contentBottom);
     ctx.stroke();
     ctx.restore();
   }
   ```
2. **Handwritten Marker Rendering:**
   - In placement draw loop:
   ```typescript
   if (placement.marginMarker) {
     const markerBaselineY = getBaseline(page.coordinates, placement.lineIndex);
     writeSegments(
       ctx,
       plainSegments(placement.marginMarker.text),
       settings,
       page.coordinates.marginMarkerLeft,
       markerBaselineY,
       random,
       {
         size: settings.fontSize * 0.95,
         color: placement.marginMarker.color || ink,
         scale: 1.0,
       }
     );
   }
   ```
   - Renders organically with the student's active handwriting personality and ink color!

---

## 5. LEFT Digital Editor Interaction Model (`RichContentEditor.tsx`)

### A. Clean Digital Representation
- The editor does **not** turn paragraphs into rigid form input fields.
- Blocks are wrapped in an inline flex/grid container or styled with a left gutter margin slot.
- A subtle margin tag chip appears in the left gutter when hovering or focusing a block.
- If a marker is set (e.g. `Q1`), it displays as an elegant badge in the gutter:
  ```
  [ Q1 ]  Introduction: A data warehouse is a centralized repository...
          It stores large amounts of structured and semi-structured data...
  ```
- Clicking the badge opens a quick popover:
  - **Quick Presets:** `[ Q1 ]` `[ Q2 ]` `[ Ans ]` `[ a) ]` `[ b) ]` `[ (i) ]` `[ (ii) ]` `[ 5M ]` `[ 10M ]`
  - **Custom Input:** Text input field with `[ Save ]` and `[ Remove ]`.
  - **Auto-Increment Intelligence:** Automatically detects the latest question number in the document and suggests $Q_{N+1}$.

---

## 6. Settings & Design Panel Integration (`src/components/editor/DesignPanel.tsx`)

Add an "Answer Sheet Margin" section under Page settings:
- **Toggle:** `Question Margin` (Enabled / Disabled).
- **Margin Width:** Slider from `54px` to `110px` (default `72px`).
- **Divider Color:** Red / Blue / Grey / Matching ruling.
- **Divider Visible:** Toggle show/hide vertical rule.
