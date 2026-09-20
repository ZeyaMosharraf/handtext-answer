# Phase M2-P4 — Answer-Sheet Layout / Question Margin System: Research

> *GSD Research Document — Prior Art, Reference Analysis, and Layout Mechanics*  
> *Phase:* M2-P4 (Answer-Sheet Layout / Question Margin System)  
> *Date:* September 2026  
> *Status:* Complete  

---

## 1. Executive Summary & Problem Statement

In academic and examination settings worldwide (e.g. CBSE, ICSE, University examination booklets, and standard ruled answer sheets), student handwritten submissions do **not** format question identifiers as standalone body paragraphs. Instead, physical answer booklets provide a dedicated **Left Question Margin** demarcated by a vertical red or grey ruling line.

### The Real-World Layout:
- **Left Margin Column (~60px–85px wide):** Reserved exclusively for question identifiers (`Q1`, `Q2`, `Q14`), answer markers (`Ans`, `Ans:`), sub-part indicators (`a)`, `b)`, `(i)`, `(ii)`), and marks (`[5M]`).
- **Main Writing Area:** Begins immediately to the right of the vertical margin divider line.
- **Vertical Alignment:** The question marker in the margin aligns horizontally on the **exact same ruled-line baseline** as the first line of the answer text, mathematical derivation, table, or graph.
- **Continuation:** Subsequent lines of the answer wrap within the main writing area directly below the first line. The marker does **not** consume a dedicated line of the notebook, nor does it push the answer down.

### The Current HandText Problem:
Prior to this phase, HandText lacked a structured answer margin. Students had to type `Q14` directly into the editor body as a regular paragraph or heading (as observed in user reference screenshot `media_1789744921545.png`). This had severe shortcomings:
1. It consumed an entire horizontal ruled line just for a short label like "Q14".
2. It pushed the entire answer down by one or two lines, distorting authentic student exam booklet formatting.
3. It forced the user to manually manage spacing, colons, and indentation.
4. It made the handwritten canvas output look like an unformatted text dump rather than a genuine university answer booklet.

---

## 2. Analysis of User Reference Screenshot (`media_1789744921545.png`)

In user-uploaded artifact `media_1789744921545.png`, we observe:
1. **Left Editor State:**
   - The student typed:
     ```text
     Q14
     The given network has one hidden layer. We have to calculate outputs y1 and y2 for four input patterns.
     ```
   - "Q14" is occupying a raw block line above the introductory text.
2. **Right Canvas Output:**
   - The page has a red vertical margin line at `coordinates.contentLeft` (~72px from the page edge).
   - The margin area to the left of the red line is completely empty and unused.
   - "Q14" is rendered *inside* the content area to the right of the red line, consuming a full line of ruled paper.
   - The actual answer begins on the line below it.
3. **The Intended Target Appearance:**
   - The red vertical margin line should act as the boundary divider between the Question Margin and the Main Answer Area.
   - `Q14` should be handwritten in the left margin space (between page left and the red line).
   - `The given network has one hidden layer...` should start on that **exact same baseline**, but to the right of the red line.

---

## 3. Prior Art & Industry Research

To identify the most robust, non-intrusive architecture, four mature document and typesetting systems were investigated:

### A. LaTeX `exam` Document Class & `marginnote` / `tcolorbox`
- **Mechanism:** In LaTeX `exam.cls`, question numbers and point values are set in the margin via `\questionshook` and `\pointsinmargin`.
- **Layout Model:** The document geometry maintains a left margin `\leftmargin` and a gutter `\labelsep`. The list label is set in a box of width `\leftmargin - \labelsep` and placed flush with the first line baseline of the item.
- **Multi-Line Wrapping:** Subsequent lines wrap strictly at `\leftmargin`, creating a clean hanging indent without shifting the label or repeating it on every wrapped line.
- **Key Takeaway:** The label belongs to the first line of the block. It does not occupy an independent vertical flow slot.

### B. Microsoft Word & Google Docs Hanging Indents & List Numbering
- **Mechanism:** In Microsoft Word's "Adjust List Indents" dialog, two independent measurements govern the line:
  1. *Number position (Left Indent):* Where the marker sits relative to the margin (e.g. `0"` or `-0.5"` outdent).
  2. *Text indent (Hanging Indent):* Where line 1 text and all wrapped lines 2..N align (e.g. `0.5"`).
- **Behavior:** The marker is horizontally constrained to the gutter. If the marker text is longer than the gutter width, it either shifts text or wraps, but for standard labels (`Q1`, `Ans`, `a)`), it sits cleanly in the left zone.
- **Key Takeaway:** A fixed content boundary (`contentLeft`) ensures all content types (text, math, tables, graphs) share a uniform left edge.

### C. CSS Grid Marginalia & Gutter Outdents
- **Mechanism:** Modern publishing layouts on the web (e.g. Tufte CSS, editorial layouts) use CSS Grid with a sidebar/margin column:
  ```css
  grid-template-columns: [margin] 72px [gutter] 16px [content] 1fr;
  ```
- **Block Alignment:** Margin markers are assigned to `grid-column: margin` and share the same `grid-row` as the paragraph.
- **Key Takeaway for HandText:** The LEFT digital editor can use a subtle flex/grid gutter container where each block has an associated left marker pill, while the block's text remains a standard ContentEditable block.

---

## 4. Evaluation of 4 Candidate Architectures for HandText

| Architecture | Description | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Option 1: Two-Column Editor** | Split the editor into two parallel editable columns (Margin Column + Main Column). | Visually mirrors final layout directly. | Disastrous UX. Tab/Enter navigation is fractured; typing long text requires hopping columns; breaks ContentEditable paste, spellcheck, undo/redo. | ❌ REJECTED |
| **Option 2: Standalone Marker Blocks** | Add a `MarkerBlock` type to `DocumentBlock` that sits in the vertical sequence. | Minimal type system changes. | Fails requirement: `MarkerBlock` would occupy its own ruled line, pushing content down unless complex 2D spatial overlapping is implemented in layout. | ❌ REJECTED |
| **Option 3: CSS Position:Absolute Markers** | Float labels in the editor with `position: absolute`. | Easy to style initially in CSS. | Extremely fragile. Breaks during window resize, font changes, scroll offsets, multi-page breaks, and export rendering. | ❌ REJECTED |
| **Option 4: Block-Level Margin Metadata (Recommended)** | Extend `BaseBlock` with an optional `marginMarker?: { type: string, text: string }`. In HTML: `data-margin-marker="Q1"`. In Layout: Anchor marker to the block's first `LayoutPlacement`. | 100% backward compatible. Zero breakage to text flow. Integrates naturally into `PageCoordinateSystem`. Seamless serialization. Works with Text, Math, Table, and Graph blocks. | Requires adding a gutter chip UI to the editor and rendering marker in `renderer.ts`. | ✅ SELECTED |

---

## 5. Detailed Coordinate & Layout Mechanics

### A. Coordinate System Alignment
In `src/lib/handwriting/layout.ts`, the page coordinate system is established:
```typescript
const marginRuleX = settings.page.margin.enabled ? settings.page.margin.position : 72;
const marginWidth = settings.page.answerMargin?.width ?? marginRuleX;
const contentLeft = marginRuleX + 16; // content starts cleanly after the red line
const marginMarkerLeft = 18; // marker padding from page left edge
```
- **Question Margin Zone:** `[marginMarkerLeft ... marginRuleX - 8]`
- **Divider Line:** Ruled vertical line drawn at `marginRuleX` (using existing red/grey margin rule).
- **Main Writing Zone:** `[contentLeft ... contentRight]`

### B. Baseline Synchronization
When `layoutDocument` processes a block with a `marginMarker`:
1. The block's content is wrapped and laid out inside the available width `contentRight - contentLeft`.
2. The *first* `FlowLine`, `FlowMathBlock`, `FlowTableRow`, or `FlowGraphBlock` generated by that block is tagged with `marginMarker: block.marginMarker`.
3. During pagination, when that placement is assigned to `lineIndex` on a page, its baseline is `getBaseline(coordinates, lineIndex)`.
4. In `renderer.ts`, `writeSegments` writes the marker text in the margin zone at that **exact same baseline**:
   ```typescript
   if (placement.marginMarker) {
     writeSegments(ctx, [placement.marginMarker.text], settings, marginMarkerLeft, baselineY, random, {
       size: settings.fontSize,
       color: placement.marginMarker.color ?? ink,
       scale: 1.0,
     });
   }
   ```
5. Subsequent lines of the same block do **not** carry the marker, so they flow naturally beneath it without any extra vertical spacing.

### C. Multi-Page Break Handling
If a block (e.g. a 50-line answer for `Q1`) spans from Page 1 to Page 2:
- Page 1 contains the first line of the block $\rightarrow$ `Q1` is rendered in the margin of Page 1.
- Page 2 contains continuation lines 31..50 $\rightarrow$ Placements on Page 2 do not carry `marginMarker`, so the margin on Page 2 remains clean and uncluttered.
- This adheres strictly to real-world examination standards.

---

## 6. Recommendations & Conclusions
1. Adopt **Option 4: Block-Level Margin Metadata**.
2. Add a `data-margin-marker` attribute to block wrapper elements in the editor.
3. Provide a sleek, non-intrusive **Gutter Chip** on hover/focus in the LEFT editor with quick presets (`Q1, Q2...`, `Ans`, `a), b)...`, `(i), (ii)...`, `Marks`) and custom text input.
4. Render the marker via the existing authentic handwriting engine in the RIGHT preview, anchored to the first line baseline.
5. Provide toggle and width control in the Design Panel under the Page Margin section.
