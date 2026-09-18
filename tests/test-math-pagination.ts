import { layoutDocument, createPageCoordinateSystem, lineCapacity } from "../src/lib/handwriting/layout";
import { parseContent } from "../src/lib/handwriting/parse";
import { DEFAULT_SETTINGS, type HandwritingSettings } from "../src/lib/handwriting/types";

function createMockCanvas(): CanvasRenderingContext2D {
  return {
    measureText: (text: string) => ({ width: text.length * 9 }),
    font: "",
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    arc: () => {},
    fillText: () => {},
    bezierCurveTo: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;
}

const ctx = createMockCanvas();
const settings: HandwritingSettings = {
  ...DEFAULT_SETTINGS,
  fontSize: 24,
  lineSpacing: 1.4,
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`PASS: ${testName}`);
    passed++;
  } else {
    console.error(`FAIL: ${testName} - ${detail ?? "assertion failed"}`);
    failed++;
  }
}

console.log("\n=== Math Pagination Tests ===\n");

// 1. Math block parsing via parseContent (HTML format)
{
  const html = `<p>Intro</p><div class="math-block" data-latex="\\alpha + \\beta"></div><p>Outro</p>`;
  const blocks = parseContent(html);
  const mathBlock = blocks.find((b) => b.kind === "math");
  assert(
    mathBlock !== undefined && mathBlock.math?.latex === "\\alpha + \\beta",
    "parseContent parses HTML math-block correctly",
    `found: ${JSON.stringify(mathBlock)}`,
  );
}

// 2. Math block parsing via parseContent (Markdown $$ format)
{
  const md = `Intro text\n\n$$\n\\sum_{i=1}^{n} x_i\n$$\n\nOutro text`;
  const blocks = parseContent(md);
  const mathBlock = blocks.find((b) => b.kind === "math");
  assert(
    mathBlock !== undefined && mathBlock.math?.latex === "\\sum_{i=1}^{n} x_i",
    "parseContent parses Markdown $$ math block correctly",
    `found: ${JSON.stringify(mathBlock)}`,
  );
}

// 3. Math block is never split across pages
{
  const coords = createPageCoordinateSystem(settings, ctx, 1, 1);
  const cap = lineCapacity(coords);

  // Fill up page so that only 1 line remaining
  const items: string[] = [];
  for (let i = 0; i < cap - 1; i++) {
    items.push(`<p>Line ${i + 1}</p>`);
  }
  // Insert multi-line math block requiring 2+ lineUnits
  items.push(`<div class="math-block" data-latex="\\frac{\\frac{a}{b}}{\\frac{c}{d}}"></div>`);

  const doc = layoutDocument(ctx, { content: items.join("\n"), settings });

  const p1Math = doc.pages[0]?.placements.filter((p) => p.type === "mathBlock") ?? [];
  const p2Math = doc.pages[1]?.placements.filter((p) => p.type === "mathBlock") ?? [];

  assert(
    p1Math.length === 0 && p2Math.length === 1,
    "Math block atomically moves to next page without being split",
    `p1=${p1Math.length}, p2=${p2Math.length}`,
  );
}

// 4. Consecutive math blocks paginate properly without baseline overlap
{
  const html = `
    <div class="math-block" data-latex="\\frac{1}{2}"></div>
    <div class="math-block" data-latex="\\frac{3}{4}"></div>
    <div class="math-block" data-latex="\\frac{5}{6}"></div>
  `;
  const doc = layoutDocument(ctx, { content: html, settings });
  const placements = doc.pages[0]?.placements.filter((p) => p.type === "mathBlock") as any[];

  assert(placements.length === 3, "All 3 math blocks placed on page 1");
  const noOverlap =
    placements[1].lineIndex >= placements[0].lineIndex + placements[0].lineUnits &&
    placements[2].lineIndex >= placements[1].lineIndex + placements[1].lineUnits;
  assert(noOverlap, "Consecutive math blocks do not overlap in baseline lineIndex", `indices: ${placements.map((p) => p.lineIndex).join(", ")}`);
}

// 5. Mixed document with headings, paragraphs, tables, and math blocks
{
  const html = `
    <h1>Exam Question 1</h1>
    <p>Calculate the entropy of system S given the state probabilities:</p>
    <div class="math-block" data-latex="H(S) = -\\sum_{i=1}^{n} p_i \\log_2(p_i)"></div>
    <table>
      <tr><th>State</th><th>Probability</th></tr>
      <tr><td>State A</td><td>0.375</td></tr>
      <tr><td>State B</td><td>0.625</td></tr>
    </table>
    <p>Substituting into the equation:</p>
    <div class="math-block" data-latex="H(S) = - \\frac{3}{8}\\log_2(\\frac{3}{8}) - \\frac{5}{8}\\log_2(\\frac{5}{8})"></div>
  `;
  const doc = layoutDocument(ctx, { content: html, settings });
  const placements = doc.pages[0]?.placements ?? [];
  const hasHeading = placements.some((p) => p.type === "line" && p.kind === "heading");
  const hasTable = placements.some((p) => p.type === "tableRow");
  const mathCount = placements.filter((p) => p.type === "mathBlock").length;

  assert(hasHeading && hasTable && mathCount === 2, "Mixed document correctly lays out headings, tables, and math");
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
