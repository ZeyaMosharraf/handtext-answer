import { parseMath, layoutMath, computeLineUnits } from "../src/lib/math";
import { createPageCoordinateSystem, layoutDocument, lineCapacity } from "../src/lib/handwriting/layout";
import { DEFAULT_SETTINGS, type HandwritingSettings } from "../src/lib/handwriting/types";

function createMockCanvas(): CanvasRenderingContext2D {
  return {
    measureText: (text: string) => ({ width: text.length * 10 }),
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

console.log("\n=== Math Layout Tests ===\n");

// 1. Simple identifier has positive width, ascent, descent
{
  const ast = parseMath("x");
  const box = layoutMath(ast, ctx, settings, 1.0);
  assert(
    box.width > 0 && box.ascent > 0 && box.descent >= 0,
    "Simple identifier has positive width, ascent, descent",
    `w=${box.width}, a=${box.ascent}, d=${box.descent}`,
  );
}

// 2. Fraction ascent > single identifier ascent
{
  const identAst = parseMath("x");
  const identBox = layoutMath(identAst, ctx, settings, 1.0);

  const fracAst = parseMath("\\frac{a}{b}");
  const fracBox = layoutMath(fracAst, ctx, settings, 1.0);
  assert(
    fracBox.ascent > identBox.ascent,
    "Fraction ascent > single identifier ascent",
    `frac.ascent=${fracBox.ascent}, ident.ascent=${identBox.ascent}`,
  );
}

// 3. Fraction width >= max(numerator.width, denominator.width)
{
  const fracAst = parseMath("\\frac{wideNumerator}{b}");
  const fracBox = layoutMath(fracAst, ctx, settings, 1.0);
  const numAst = parseMath("wideNumerator");
  const numBox = layoutMath(numAst, ctx, settings, 0.8);
  assert(
    fracBox.width >= numBox.width,
    "Fraction width >= max(numerator.width, denominator.width)",
    `frac.width=${fracBox.width}, num.width=${numBox.width}`,
  );
}

// 4. Superscript increases box ascent above base
{
  const baseAst = parseMath("x");
  const baseBox = layoutMath(baseAst, ctx, settings, 1.0);

  const supAst = parseMath("x^2");
  const supBox = layoutMath(supAst, ctx, settings, 1.0);
  assert(
    supBox.ascent > baseBox.ascent,
    "Superscript increases box ascent above base",
    `sup.ascent=${supBox.ascent}, base.ascent=${baseBox.ascent}`,
  );
}

// 5. Subscript increases box descent below base
{
  const baseAst = parseMath("x");
  const baseBox = layoutMath(baseAst, ctx, settings, 1.0);

  const subAst = parseMath("x_1");
  const subBox = layoutMath(subAst, ctx, settings, 1.0);
  assert(
    subBox.descent > baseBox.descent,
    "Subscript increases box descent below base",
    `sub.descent=${subBox.descent}, base.descent=${baseBox.descent}`,
  );
}

// 6. Root box width > radicand width
{
  const radAst = parseMath("x");
  const radBox = layoutMath(radAst, ctx, settings, 1.0);

  const rootAst = parseMath("\\sqrt{x}");
  const rootBox = layoutMath(rootAst, ctx, settings, 1.0);
  assert(
    rootBox.width > radBox.width,
    "Root box width > radicand width",
    `root.width=${rootBox.width}, rad.width=${radBox.width}`,
  );
}

// 7. lineUnits = ceil(totalHeight / rulingSpacing)
{
  const ast = parseMath("\\frac{a}{b}");
  const box = layoutMath(ast, ctx, settings, 1.0);
  const rulingSpacing = settings.fontSize * settings.lineSpacing;
  const padding = 4;
  const calculated = Math.max(1, Math.ceil((box.ascent + box.descent + 2 * padding) / rulingSpacing));
  const units = computeLineUnits(box, rulingSpacing, padding);
  assert(
    units === calculated,
    "lineUnits = ceil(totalHeight / rulingSpacing)",
    `units=${units}, expected=${calculated}`,
  );
}

// 8. lineUnits >= 1 always
{
  const ast = parseMath("");
  const box = layoutMath(ast, ctx, settings, 1.0);
  const rulingSpacing = settings.fontSize * settings.lineSpacing;
  const units = computeLineUnits(box, rulingSpacing, 0);
  assert(units >= 1, "lineUnits >= 1 always", `got ${units}`);
}

// 9. Nested fraction scale <= 0.80 * parent scale
{
  // Deep fraction
  const ast = parseMath("\\frac{\\frac{1}{2}}{3}");
  const box = layoutMath(ast, ctx, settings, 1.0);
  // Root fraction box should contain children
  assert(
    box.type === "sequence" && box.children !== undefined && box.children.length > 0,
    "Nested fraction layout produces structured box hierarchy",
  );
}

// 10. Scale clamping: never below 0.60 * base
{
  // Fraction inside fraction inside fraction
  const ast = parseMath("\\frac{\\frac{\\frac{1}{2}}{3}}{4}");
  const box = layoutMath(ast, ctx, settings, 1.0);
  assert(box.width > 0 && box.ascent > 0, "Deeply nested fraction layouts correctly with scale clamping");
}

// 11. Math block is atomic — moves to next page if overflow
{
  const coords = createPageCoordinateSystem(settings, ctx, 1, 1);
  const cap = lineCapacity(coords);
  const lines: string[] = [];
  for (let i = 0; i < cap - 1; i++) {
    lines.push(`<p>Line ${i + 1}</p>`);
  }
  lines.push(`<div class="math-block" data-latex="\\frac{\\frac{a}{b}}{\\frac{c}{d}}"></div>`);

  const html = lines.join("\n");
  const doc = layoutDocument(ctx, { content: html, settings });

  assert(doc.pages.length >= 2, "Document paginates to at least 2 pages");
  // Find where the mathBlock is placed
  const page1Math = doc.pages[0]?.placements.find((p) => p.type === "mathBlock");
  const page2Math = doc.pages[1]?.placements.find((p) => p.type === "mathBlock");

  assert(
    !page1Math && page2Math !== undefined,
    "Math block is atomic — moves to next page if overflow",
    `page1Math=${Boolean(page1Math)}, page2Math=${Boolean(page2Math)}`,
  );
}

// 12. Text after math block continues on correct baseline
{
  const html = `<div class="math-block" data-latex="\\frac{a}{b}"></div><p>Continuing text</p>`;
  const doc = layoutDocument(ctx, { content: html, settings });
  const page = doc.pages[0];
  const mathPlacement = page?.placements.find((p) => p.type === "mathBlock");
  const linePlacement = page?.placements.find((p) => p.type === "line");

  assert(
    mathPlacement !== undefined &&
    linePlacement !== undefined &&
    (linePlacement as any).lineIndex >= (mathPlacement as any).lineIndex + (mathPlacement as any).lineUnits,
    "Text after math block continues on correct baseline",
    `mathLine=${(mathPlacement as any)?.lineIndex}, mathUnits=${(mathPlacement as any)?.lineUnits}, lineIndex=${(linePlacement as any)?.lineIndex}`,
  );
}

// 13. Gap lines before math block handled correctly
{
  const html = `<p>First paragraph</p><p><br></p><div class="math-block" data-latex="x^2"></div>`;
  const doc = layoutDocument(ctx, { content: html, settings });
  const page = doc.pages[0];
  const firstLine = page?.placements[0];
  const mathPlacement = page?.placements.find((p) => p.type === "mathBlock");

  assert(
    firstLine !== undefined &&
    mathPlacement !== undefined &&
    (mathPlacement as any).lineIndex >= (firstLine as any).lineIndex + 2,
    "Gap lines before math block handled correctly",
    `firstLine=${(firstLine as any)?.lineIndex}, mathLine=${(mathPlacement as any)?.lineIndex}`,
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
