# HandText — Handwriting Rendering Pipeline

> **The Physics of Digital-to-Handwritten Synthesis: Parsing, Layout, and Canvas Rasterization**  
> *Target Audience:* Graphics Engineers, Typography Specialists, Core Contributors  
> *Last Updated:* September 2026  
> *Document Status:* Active & Canonical

---

## 1. Engine Pipeline Overview

Transforming typed digital rich-text into an authentic student handwritten document requires a deterministic, multi-stage processing pipeline:

```
┌───────────────────────────────┐
│     RichContentEditor         │  User types and formats text in semantic ContentEditable container
└──────────────┬────────────────┘
               │  Raw HTML String (with <p>, <span>, data-scale, data-color, data-highlight)
               ▼
┌───────────────────────────────┐
│     HTML Tokenizer & Parser   │  parseHtmlContent() in parse.ts:
│     (Stack-Based Parser)      │  Extracts Block[] and decomposes text into normalized Seg[] runs
└──────────────┬────────────────┘
               │  Block[] (with Seg[])
               ▼
┌───────────────────────────────┐
│     Master Ruling Lattice     │  layoutDocument() in layout.ts:
│     & Pagination Engine       │  Calculates ruling intervals, quantizes header/footer bands,
│                               │  performs segment-aware word wrapping, and executes multi-pass pagination
└──────────────┬────────────────┘
               │  LayoutDocument (LayoutPage[] with coordinates & line placements)
               ▼
┌───────────────────────────────┐
│     Organic Stroke Renderer   │  renderPages() in renderer.ts:
│     (Canvas 2D Synthesis)     │  Draws paper texture, ruling lines, translucent highlighter washes,
│                               │  and synthesizes individual character strokes with PRNG physics
└──────────────┬────────────────┘
               │  HTML5 Canvas Elements (Preview & High-Res)
               ▼
┌───────────────────────────────┐
│     Export Pipeline           │  Converts canvas rasters to vector-accurate multi-page PDF (jsPDF)
│     (PDF / PNG / ZIP)         │  or uncompressed PNG image zip archives (JSZip)
└───────────────────────────────┘
```

---

## 2. Stage 1: Stack-Based Inline HTML Parser (`parse.ts`) `[CURRENT]`

When text is edited in `RichContentEditor`, the resulting DOM structure contains nested formatting tags (`<strong>`, `<em>`, `<u>`, `<span style="...">`, `<mark>`).

### Tag Tokenization & Style Frames
`parseInlineHtml(innerHtml: string): Seg[]` utilizes a stack of `StyleFrame` objects:
```typescript
interface StyleFrame {
  tag: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  scale?: number;
  highlight?: string;
}
```

- When an opening tag is encountered (e.g., `<strong data-scale="1.2">`), a new frame is pushed onto the stack.
- When text nodes are processed, the effective formatting is resolved by querying the active stack top:
  - `bold`: active if any frame in the stack asserts bold.
  - `italic`: active if any frame in the stack asserts italic.
  - `underline`: active if any frame in the stack asserts underline.
  - `color`: inherits the most recently pushed color attribute.
  - `scale`: inherits the most recently pushed scale attribute.
  - `highlight`: inherits the most recently pushed background highlight.

### Scale Normalization
To prevent arbitrary micro-scaling, `normalizeFontScale()` snaps relative scale values to four discrete levels:
```typescript
export function normalizeFontScale(rawScale: number): number {
  if (rawScale <= 0.92) return 0.85; // Small
  if (rawScale <= 1.1)  return 1.0;  // Normal
  if (rawScale <= 1.3)  return 1.2;  // Medium
  return 1.4;                        // Large
}
```

### Contiguous Segment Merging
After parsing, adjacent segments sharing identical style properties are merged into a single segment to minimize draw-call overhead.

---

## 3. Stage 2: Master Ruling Lattice & Layout Engine (`layout.ts`) `[CURRENT]`

### The Problem with Naive Layout
Standard word processors use font bounding boxes and variable line-heights. When rendering onto ruled notebook paper, characters quickly drift above or below the printed rules, completely destroying the illusion of human handwriting on paper.

### The Master Ruling Lattice Solution
In HandText, the paper's ruling lines dictate the geometry of text baselines:

1. **Ruling Spacing Formula**:
   $$\text{rulingSpacing} = \text{settings.fontSize} \times \text{settings.lineSpacing}$$
2. **Quantized Header and Footer Boundaries**:
   Academic header and footer bands must never end mid-line. Their reserved heights are quantized to integer multiples of `rulingSpacing`:
   $$\text{headerHeight} = \left\lceil \frac{\text{rawHeaderHeight}}{\text{rulingSpacing}} \right\rceil \times \text{rulingSpacing}$$
   $$\text{firstBaselineY} = \text{headerHeight} + \text{rulingSpacing}$$
3. **Absolute Baseline Lock**:
   Every written line index $i \in \{0, 1, 2, \dots\}$ sits on an exact baseline:
   $$\text{baseline}(i) = \text{firstBaselineY} + i \times \text{rulingSpacing}$$
4. **Bottom Boundary Protection**:
   The last line of content on a page is strictly bounded by the top of the footer band:
   $$\text{contentBottom} = \text{pageHeight} - \text{footerHeight} - 1$$

### Heterogeneous Word Wrapping
Lines frequently contain mixed formatting (e.g., normal words followed by a large bold term followed by a small subscript). HandText splits segments into whitespace tokens and measures each token's physical width:
$$\text{width} = (\text{ctx.measureText}(\text{token}).\text{width} \times \text{compactness} + \text{token.length} \times \text{letterSpacing}) \times \text{scale}$$
Tokens are accumulated until `availableWidth` is reached, then wrapped to line index $i+1$.

### Multi-Pass Pagination Convergence
Footers and headers frequently contain dynamic total page tokens (such as `Page n of total`) or conditional display rules (`ApplyTo: "last"`). If displaying a footer on the last page expands the content onto a new page, a circular dependency arises.

`layoutDocument()` executes an iterative convergence loop (up to 3 passes):
```typescript
let pages = paginate(flow, settings, ctx, 1);
for (let pass = 0; pass < 3; pass++) {
  const next = paginate(flow, settings, ctx, pages.length);
  if (next.length === pages.length) {
    pages = next;
    break;
  }
  pages = next;
}
```

---

## 4. Stage 3: Organic Stroke Synthesis (`renderer.ts`) `[CURRENT]`

The rendering engine draws the page onto an HTML5 2D Canvas using physical stroke simulation.

### 4.1 Stationery & Furniture Layers
1. **Paper Background**: Fills canvas with chosen tone (`#ffffff`, `#fdfcf7`, `#fbf3e2`, `#fdf8dd`).
2. **Procedural Paper Grain**: Injects high-frequency microscopic alpha noise to simulate paper fiber texture.
3. **Margin Rules**: Renders vertical red/grey margin lines with realistic pen-like translucency.
4. **Ruling Lines**: Draws horizontal guidelines (ruled, double, narrow, grid, graph) aligned to the lattice.
5. **Academic Headers/Footers**: Draws metadata elements (Student Name, Roll No, Date, Page Numbers) into designated slots.

### 4.2 Fluorescent Highlighter Wash
Highlighter washes are drawn **behind** the text to simulate ink absorption:
- Target color rendered with `globalAlpha = 0.34`.
- Employs `ctx.roundRect()` with a 3px radius and microscopic PRNG boundary jitter.

### 4.3 Character-by-Character Stroke Synthesis
To eliminate repetitive digital uniformity, each character is rendered independently with pseudorandom variations seeded by its string index and content:

```typescript
// Slant & Italic Transform
const italicSlant = segment.italic ? 12 : 0;
const slant = (settings.slant + italicSlant + (random() - 0.5) * settings.slantVariation + speed * 1.2) * (Math.PI / 180);
const rotation = (random() - 0.5) * 0.012 * settings.imperfection * 6;
const characterBaselineJitter = (random() - 0.5) * settings.baselineVariation;
const horizontal = settings.compactness * widthJitter * (1 - speed * 0.06);

ctx.save();
ctx.translate(x, baselineY + characterBaselineJitter);
ctx.rotate(rotation);
ctx.transform(horizontal, 0, -Math.tan(slant), 1, 0, 0);

// Dual-Pass Ink Simulation (Simulates fountain/gel pen fiber bleed)
const stroke = (settings.penWidth - 1) * 0.7 + pressure * 0.9 + (segment.bold ? 1.1 : 0);
if (stroke > 0.12) {
  ctx.lineWidth = stroke;
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.strokeText(character, 0, 0); // Stroke pass
}
ctx.fillText(character, 0, 0);       // Core fill pass
ctx.restore();
```

### 4.4 Hand-Drawn Underlines
Underlines are synthesized as authentic Bézier curves with randomized anchor and control point offsets:
$$\text{midY} = y + (\text{random}() - 0.5) \times 2$$
$$\text{curve} = \text{bezierCurveTo}(x_1 + w \times 0.35, \text{midY}, x_1 + w \times 0.7, \text{midY} + \text{jitter}, x_2, y + \text{endJitter})$$

---

## 5. Rich Formatting Capabilities Matrix `[CURRENT]`

| Formatting Command | DOM Representation | Canvas Visual Manifestation |
| :--- | :--- | :--- |
| **Bold** | `<strong>`, `<b>` | Increased stroke weight (`+1.1px`), 100% ink opacity, darker tone. |
| **Italic** | `<em>`, `<i>` | Added $+12^\circ$ forward slant in character transformation matrix. |
| **Underline** | `<u>` | Organic, jittered hand-drawn Bézier curve below baseline. |
| **Font Scale** | `data-scale="0.85"` to `"1.4"` | Scaled character size, adjusted advance width, and proportional letter spacing. |
| **Student Ink** | `data-color="#hex"` | Custom ink color per character run (Blue, Royal, Black, Red, Green). |
| **Highlighter** | `data-highlight="#hex"` | Soft, translucent rounded wash ($34\%$ opacity) behind text glyphs. |
| **Tables** | `<table>` | Hand-drawn bordered grid cells with automated multi-page continuation and optional repeated headers. |

---

## 6. Stage 4: Export Engine `[CURRENT]`

1. **Multi-Page PDF (`jsPDF`)**:
   - Compiles each generated canvas into full-bleed page raster frames.
   - Preserves exact physical dimensions (A4: 210mm × 297mm).
2. **Individual PNGs & ZIP Archive (`JSZip`)**:
   - Exports raw 300-DPI PNG files bundled into a single ZIP archive for high-resolution photo printing or digital LMS upload.
