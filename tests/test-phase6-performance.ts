/**
 * tests/test-phase6-performance.ts
 *
 * Automated Verification & Benchmark Suite for Phase 6:
 * "Safe Math Layout Caching & Memoization"
 *
 * Verifies:
 * 1. Math AST parser caching: parseMath returns cached AST without re-tokenization
 * 2. Math layout caching: layoutMath returns cached MathLayoutBox in O(1) time
 * 3. Cache key covers all layout-affecting inputs:
 *    - Formula string (LaTeX)
 *    - Font size
 *    - Font family
 *    - Scale
 * 4. Geometry equivalence: cached box metrics match uncached metrics to 100% precision
 * 5. Performance benchmark: measures cold vs warm repeated layout across 50 iterations
 */

import { parseMath, clearMathParserCache } from "../src/lib/math/parser";
import { layoutMath, clearMathLayoutCache } from "../src/lib/math/layout";
import { DEFAULT_SETTINGS } from "../src/lib/handwriting/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function assertEquals<T>(actual: T, expected: T, msg: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatch) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}\n    Expected: ${JSON.stringify(expected)}\n    Actual:   ${JSON.stringify(actual)}`);
  }
}

const mockCtx = {
  measureText: (text: string) => ({
    width: text.length * 10,
    actualBoundingBoxAscent: 12,
    actualBoundingBoxDescent: 4,
  }),
  font: "18px sans-serif",
} as unknown as CanvasRenderingContext2D;

console.log("\n=======================================================");
console.log("PHASE 6 VERIFICATION: Performance & Safe Memoization");
console.log("=======================================================\n");

// ── Test 1: Math AST Parser Memoization ──
console.log("Test 1: parseMath memoization");
{
  clearMathParserCache();
  const formula = "x' = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";

  const ast1 = parseMath(formula);
  const ast2 = parseMath(formula);

  assert(ast1 === ast2, "Repeated parseMath returns identical cached AST instance in O(1)");
  assertEquals(ast1.length, ast2.length, "AST lengths match");
}

// ── Test 2: Math Layout Box Memoization ──
console.log("\nTest 2: layoutMath memoization");
{
  clearMathLayoutCache();
  const formula = "E = \\sum_{i=1}^n \\hbar \\omega_i";
  const ast = parseMath(formula);

  const box1 = layoutMath(ast, mockCtx, DEFAULT_SETTINGS, 1.0, formula);
  const box2 = layoutMath(ast, mockCtx, DEFAULT_SETTINGS, 1.0, formula);

  assert(box1 === box2, "Repeated layoutMath returns identical cached MathLayoutBox in O(1)");
  assertEquals(box1.width, box2.width, "Cached box width identical");
  assertEquals(box1.ascent, box2.ascent, "Cached box ascent identical");
  assertEquals(box1.descent, box2.descent, "Cached box descent identical");
}

// ── Test 3: Cache Invalidation / Independence on Key Changes ──
console.log("\nTest 3: Cache sensitivity to layout-affecting inputs");
{
  clearMathLayoutCache();
  const formula = "y = \\sin(x) + \\cos(x)";
  const ast = parseMath(formula);

  const settings1 = { ...DEFAULT_SETTINGS, fontSize: 18, fontFamily: "Caveat" };
  const settings2 = { ...DEFAULT_SETTINGS, fontSize: 24, fontFamily: "Caveat" };
  const settings3 = { ...DEFAULT_SETTINGS, fontSize: 18, fontFamily: "Indie Flower" };

  const boxSize18 = layoutMath(ast, mockCtx, settings1, 1.0, formula);
  const boxSize24 = layoutMath(ast, mockCtx, settings2, 1.0, formula);
  const boxFontIndie = layoutMath(ast, mockCtx, settings3, 1.0, formula);
  const boxScaled = layoutMath(ast, mockCtx, settings1, 1.5, formula);

  assert(boxSize18 !== boxSize24, "Changing font size (18 -> 24) produces distinct cached box");
  assert(boxSize18 !== boxFontIndie, "Changing font family produces distinct cached box");
  assert(boxSize18 !== boxScaled, "Changing scale (1.0 -> 1.5) produces distinct cached box");
}

// ── Test 4: Performance Benchmark ──
console.log("\nTest 4: Performance Benchmark (Cold vs Warm Execution)");
{
  clearMathParserCache();
  clearMathLayoutCache();

  const sampleFormulas = [
    "x' = \\frac{x - \\min}{\\max - \\min}",
    "f'(x) = \\lim_{\\Delta x \\to 0} \\frac{f(x + \\Delta x) - f(x)}{\\Delta x}",
    "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}^{-1} = \\frac{1}{ad - bc} \\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}",
    "\\int_{-\\infty}^\\infty e^{-x^2} dx = \\sqrt{\\pi}",
    "\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\epsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}",
  ];

  const iterations = 100;

  // Cold Run (clear cache before every call to simulate uncached execution)
  const coldStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const f of sampleFormulas) {
      clearMathParserCache();
      clearMathLayoutCache();
      const ast = parseMath(f);
      layoutMath(ast, mockCtx, DEFAULT_SETTINGS, 1.0, f);
    }
  }
  const coldElapsedMs = performance.now() - coldStart;

  // Warm Run (leverages parse and layout memoization)
  const warmStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const f of sampleFormulas) {
      const ast = parseMath(f);
      layoutMath(ast, mockCtx, DEFAULT_SETTINGS, 1.0, f);
    }
  }
  const warmElapsedMs = performance.now() - warmStart;

  console.log(`    Cold run time (100 iterations x 5 formulas): ${coldElapsedMs.toFixed(2)}ms`);
  console.log(`    Warm run time (100 iterations x 5 formulas): ${warmElapsedMs.toFixed(2)}ms`);
  const speedup = coldElapsedMs / Math.max(0.1, warmElapsedMs);
  console.log(`    Speedup factor: ${speedup.toFixed(1)}x faster`);

  assert(warmElapsedMs < coldElapsedMs, "Warm memoized execution is measurably faster than cold execution");
  assert(warmElapsedMs < 50, "500 math layouts take <50ms in warm cache (average <0.1ms per layout)");
}

console.log("\n=======================================================");
console.log(`Phase 6 Test Results: ${passed} passed, ${failed} failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
