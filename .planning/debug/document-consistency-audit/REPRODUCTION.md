# Minimal Reproduction Suite

This document provides minimal, standalone reproduction payloads for every discovered bug.

---

## BUG-CONSISTENCY-001: Math Attribute Regex Truncation on Single Quotes

### Reproduction Payload
```html
<p>Equation:</p>
<div class="math-block" data-latex="x' = x - min / max - min"></div>
```
### Execution
```ts
import { parseContent } from "@/lib/handwriting/parse";
const blocks = parseContent(`<div class="math-block" data-latex="x' = x - min / max - min"></div>`);
console.log(blocks[0]?.math?.latex);
```
### Expected Behavior
`latex` is `"x' = x - min / max - min"`.
### Actual Behavior
`latex` is `"x"`. All content from `'` onward is dropped.

---

## BUG-CONSISTENCY-002: Table Serialization to `[object Object]` in `blocksToHtml`

### Reproduction Payload
```ts
import { parseContent, blocksToHtml } from "@/lib/handwriting/parse";

const html = `<table><thead><tr><th>Header A</th><th>Header B</th></tr></thead><tbody><tr><td>Val 1</td><td>Val 2</td></tr></tbody></table>`;
const blocks = parseContent(html);
const serialized = blocksToHtml(blocks);
console.log(serialized);
```
### Expected Behavior
Table HTML contains `<th>Header A</th><th>Header B</th>` and `<td>Val 1</td><td>Val 2</td>`.
### Actual Behavior
Table HTML contains:
```html
<table><tbody><tr><th>[object Object]</th><th>[object Object]</th></tr><tr><td>[object Object]</td><td>[object Object]</td></tr></tbody></table>
```
All table data is permanently destroyed.

---

## BUG-CONSISTENCY-003: Math / Graph Block Nested Inside `<p>` Tag Deletion

### Reproduction Payload
```html
<p>Before math <div class="math-block" data-latex="y = mx + b"></div> After math</p>
```
### Execution
```ts
import { parseContent } from "@/lib/handwriting/parse";
const blocks = parseContent(`<p>Before math <div class="math-block" data-latex="y = mx + b"></div> After math</p>`);
console.log(blocks.map(b => b.kind));
```
### Expected Behavior
Three blocks parsed: `["paragraph", "math", "paragraph"]`.
### Actual Behavior
Two blocks parsed: `["paragraph", "paragraph"]`.
The MathBlock is completely deleted.

---

## BUG-CONSISTENCY-004: "Write on Page" Textarea Obliterates Document Structure

### Reproduction Steps
1. In `EditorWorkspace`, insert a MathBlock or Table.
2. Click "Write on page" button above the handwritten preview.
3. Type a single character into the textarea overlay.
### Expected Behavior
The typed character is added to the text while preserving math blocks, tables, graphs, and styling.
### Actual Behavior
`plainTextToHtml(e.target.value)` runs. Every line is wrapped in `<p>`. All MathBlocks, Tables, Graphs, Colors, Scales, and Margin Markers are permanently erased from the document state.

---

## BUG-CONSISTENCY-005: GraphBlock Property Mismatch Crash in `blockSerialization.ts`

### Reproduction Payload
```ts
import { blocksToHtml } from "@/lib/editor/blockSerialization";
import type { DocumentBlock } from "@/types/document";

const blocks: DocumentBlock[] = [
  {
    id: "g1",
    type: "graph",
    graphDef: {
      type: "linear",
      title: "Line",
      data: { m: 1, c: 0 },
      space: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, showGrid: true, showAxisLabels: true, originVisible: true },
    },
  },
];
blocksToHtml(blocks);
```
### Expected Behavior
Serializes to HTML without error.
### Actual Behavior
`TypeError: Cannot read properties of undefined (reading 'title')` throws at line 144 of `blockSerialization.ts`.

---

## BUG-CONSISTENCY-007: Table Top Coordinate Below First Ruling Line (`lineIndex - 1 = -1`)

### Reproduction Payload
```html
<table><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>D1</td><td>D2</td></tr></tbody></table>
```
### Execution in Layout / Renderer
```ts
// Table starts at top of page (lineIndex: 0)
const top = getBaseline(coordinates, placement.lineIndex - 1);
console.log("Top border Y:", top, "First baseline Y:", coordinates.firstBaselineY);
```
### Expected Behavior
`top >= coordinates.contentTop`, resting safely below the header region.
### Actual Behavior
`top = firstBaselineY - rulingSpacing`, which is above `contentTop`, drawing the top border into the page header band.

---

## BUG-CONSISTENCY-009: Margin Width Inconsistency (100px Canvas vs 72px Editor)

### Reproduction Steps
1. Enable Answer Margin in Settings.
2. Note left editor margin width: `72px` (`marginWidth` in `RichContentEditor.tsx`).
3. Note right canvas divider position: `100px` (hardcoded in `src/lib/handwriting/layout.ts` line 400).
4. Change Answer Margin width in Settings to `120px`.
### Expected Behavior
Both editor and canvas update their margin divider line to 120px.
### Actual Behavior
Left editor updates to 120px. Canvas ignores setting and stays at 100px.
