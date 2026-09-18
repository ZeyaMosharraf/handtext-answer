# M2-P1 — Handwritten Graph Support — UAT Criteria

> *GSD Phase UAT — User Acceptance Test cases*  
> *Phase:* M2-P1  
> *Date:* September 2026  
> *Status:* Criteria defined — to be executed after implementation

---

## Test Environment

- Browser: Chrome (latest)
- URL: `http://localhost:5173` (dev server)
- Paper: A4, ruled, blue ink (default settings)

---

## UAT-G01 — Graph Insertion Lifecycle

**Scenario:** A user inserts a basic coordinate graph into an existing document.

**Steps:**
1. Open the editor with an empty document
2. Type a paragraph: "The graph below shows the coordinate axes."
3. Click "Graph" in the toolbar
4. Select type: "Coordinate"
5. Set X range: -5 to 5, Y range: -5 to 5
6. Enable grid: Yes
7. Title: "Coordinate axes"
8. Click "Insert Graph"

**Expected:**
- The editor shows a graph placeholder block below the paragraph
- The canvas preview updates to show a hand-drawn coordinate graph with grid, axes, arrowheads, and title
- The DOM contains `<div class="graph-block" data-graph-definition="...">` with valid JSON in the attribute
- No JavaScript errors in the browser console

---

## UAT-G02 — Function Graph: y = x²

**Steps:**
1. Open editor
2. Click Graph → select type "Function"
3. Expression: `x^2`
4. X range: -5 to 5, Y range: -2 to 26
5. Label: `y = x²`
6. Title: "Quadratic function"
7. Insert

**Expected:**
- Canvas shows a parabola that is visually handwritten (irregular pen strokes, not perfectly smooth)
- The parabola passes through (0,0) visible at the bottom of the curve
- The parabola is symmetric
- The label "y = x²" appears near the curve
- Curve does NOT draw a line across any NaN region

---

## UAT-G03 — Function Graph: y = sin(x)

**Steps:**
1. Insert a Function graph with expression: `sin(x)`
2. X range: -6.28 to 6.28 (≈ -2π to 2π)
3. Y range: -1.5 to 1.5
4. Grid: Yes

**Expected:**
- Smooth-looking sine wave (with natural hand-drawn irregularity)
- Crosses y=0 at approximately x = 0, ±π, ±2π (visually correct)
- Does not produce any spurious vertical lines

---

## UAT-G04 — Discontinuous Function: y = tan(x)

**Steps:**
1. Insert a Function graph: `tan(x)`
2. X range: -5 to 5, Y range: -10 to 10

**Expected:**
- Multiple disconnected curve branches visible
- NO vertical lines connecting the branches near asymptotes (x ≈ ±π/2, ±3π/2)
- Each branch curves smoothly toward ±∞ and stops at the graph boundary

---

## UAT-G05 — Point Data Graph

**Steps:**
1. Click Graph → type "Points"
2. Add points: (1,2), (2,4), (3,9), (4,16)
3. Labels: show "(1,2)", "(2,4)", etc.
4. Connect: Yes (line graph connecting points in order)
5. Title: "Data points"
6. Insert

**Expected:**
- Four point markers visible at the correct positions
- Lines drawn between consecutive points
- Labels appear near each point
- Points are at mathematically correct positions relative to the axes

---

## UAT-G06 — Scatter Plot (No Connect)

**Steps:**
1. Insert a graph type "Scatter"
2. Add 6 random points with no labels
3. Connect: No

**Expected:**
- Six point markers (cross or dot) at correct positions
- No lines between points

---

## UAT-G07 — Graph Persistence (IndexedDB)

**Steps:**
1. Insert any graph into the editor
2. Wait for autosave (observe "Saved Locally" status)
3. Close and reopen the browser tab
4. Navigate back to the project

**Expected:**
- The graph reappears exactly as inserted (same type, same expression, same axes)
- The canvas renders the graph correctly after restore
- No "undefined" or empty graph blocks

---

## UAT-G08 — Graph Persistence (Cloud Save)

**Steps:**
1. Insert a graph
2. Press Ctrl+S to explicitly save to cloud
3. Open the project from a different browser profile / incognito window

**Expected:**
- The graph loads correctly in the second browser
- The `data-graph-definition` attribute is present in the loaded HTML

---

## UAT-G09 — Multiple Graphs in One Document

**Steps:**
1. Insert 3 different graphs in a document:
   - Graph 1: Coordinate axes
   - Graph 2: y = sin(x)
   - Graph 3: Points data
2. Add text between each graph

**Expected:**
- All 3 graphs appear in the correct document order
- Text between graphs is correctly positioned on ruled lines
- No graph overlaps another or overlaps text

---

## UAT-G10 — Graph Pagination (Atomic)

**Steps:**
1. Fill approximately 80% of page 1 with text
2. Insert a large graph (height: ~450px at 30px ruling) that will not fit in remaining space

**Expected:**
- The graph appears at the TOP of page 2 (not split across pages)
- The remaining lines on page 1 are left blank (no graph content on page 1)
- The text before the graph is still on page 1

---

## UAT-G11 — Math + Graph Coexistence

**Steps:**
1. Insert a math block: `y = x^2` (LaTeX: `y = x^{2}`)
2. Insert a graph directly below showing the function y = x²
3. Insert another math block: `\frac{dy}{dx} = 2x`
4. Render the canvas

**Expected:**
- Math block 1 renders as handwritten math notation
- Graph renders as handwritten graph below it
- Math block 2 renders below the graph
- No layout corruption; all items in correct vertical order

---

## UAT-G12 — Graph Visual Quality Check

**Manual visual inspection after inserting a function graph:**

- [ ] Axes are visibly drawn by hand (slight wavering, not pixel-perfect straight lines)
- [ ] Arrowheads look hand-drawn (two short strokes at ~20° angle)
- [ ] Tick marks are short perpendicular strokes with natural variation
- [ ] Tick labels are in the document's handwriting font
- [ ] The curve has natural pen stroke variation (not a smooth SVG bezier)
- [ ] Grid lines are clearly lighter than the axes
- [ ] The overall graph reads as "student drew this" not "computer generated this"

---

## UAT-G13 — Expression Parse Error Handling

**Steps:**
1. Open GraphInsertModal
2. Enter invalid expression: `x^^2`
3. Observe

**Expected:**
- An inline error message appears in the modal: "Invalid expression: unexpected token"
- The "Insert Graph" button is disabled or clicking it shows the error
- The application does NOT crash

---

## UAT-G14 — Graph Without Title or Labels

**Steps:**
1. Insert a function graph with no title, no axis labels
2. X range: -3 to 3, Y range: -9 to 9
3. Grid: No

**Expected:**
- Graph renders without a title or axis labels
- The graph area is smaller/tighter without the padding for missing elements
- Axes and curve are still correctly drawn
- No crash or empty/undefined elements rendered

---

## Pass Criteria

All UAT cases must pass before M2-P1 is considered complete.
Critical blockers: UAT-G01, G02, G07, G10, G11 (insertion, functions, persistence, pagination, coexistence).
Visual quality: UAT-G12 must be manually approved by the developer.
