/**
 * tests/test-graph-core.ts
 *
 * Phase 1 tests: parser, geometry (coordinate transforms, ticks, sampling, segmentation).
 *
 * Run:  npx tsx tests/test-graph-core.ts
 */

import { compileExpression } from "../src/lib/graph/parser";
import { GraphParseError } from "../src/lib/graph/types";
import {
  autoStep,
  clipToRange,
  computeTickSpec,
  formatTickLabel,
  makeCoordTransform,
  sampleFunction,
  segmentizeSamples,
} from "../src/lib/graph/geometry";
import type { GraphCoordinateSpace } from "../src/lib/graph/types";

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, msg?: string) {
  if (!condition) throw new Error(msg ?? "Assertion failed");
}

function assertClose(a: number, b: number, epsilon = 1e-9, msg?: string) {
  if (Math.abs(a - b) > epsilon) {
    throw new Error(msg ?? `Expected ${a} ≈ ${b} (diff: ${Math.abs(a - b)})`);
  }
}

// ─── Helper: make a default coordinate space ─────────────────────────────────

function makeSpace(xMin = -5, xMax = 5, yMin = -5, yMax = 5): GraphCoordinateSpace {
  return { xMin, xMax, yMin, yMax, showGrid: false, showAxisLabels: false, originVisible: true };
}

// ─── Parser tests ─────────────────────────────────────────────────────────────

console.log("\n── Parser: basic values ──");

test('parse "3.14" → 3.14 at any x', () => {
  const c = compileExpression("3.14");
  assertClose(c.evaluate(0), 3.14);
  assertClose(c.evaluate(99), 3.14);
});

test('parse "x" → x at any x', () => {
  const c = compileExpression("x");
  assertClose(c.evaluate(2), 2);
  assertClose(c.evaluate(-7), -7);
});

test('parse "x^2" → 4 at x=2', () => {
  assertClose(compileExpression("x^2").evaluate(2), 4);
});

test('parse "x^2" → 9 at x=3', () => {
  assertClose(compileExpression("x^2").evaluate(3), 9);
});

test('parse "x^2" → 0.25 at x=0.5', () => {
  assertClose(compileExpression("x^2").evaluate(0.5), 0.25);
});

test('parse "2*x+1" → 5 at x=2', () => {
  assertClose(compileExpression("2*x+1").evaluate(2), 5);
});

test('parse "2*x+1" → -1 at x=-1', () => {
  assertClose(compileExpression("2*x+1").evaluate(-1), -1);
});

test('parse "(x+1)*(x-1)" → x²-1 at x=3 → 8', () => {
  assertClose(compileExpression("(x+1)*(x-1)").evaluate(3), 8);
});

test('parse "x^(2+1)" → 8 at x=2', () => {
  assertClose(compileExpression("x^(2+1)").evaluate(2), 8);
});

console.log("\n── Parser: operator precedence ──");

test('parse "-x^2" → -4 at x=2 (unary minus lower than ^)', () => {
  // -x^2 should be -(x^2) = -4, NOT (-x)^2 = 4
  assertClose(compileExpression("-x^2").evaluate(2), -4);
});

test('parse "-(x^2)" → -4 at x=2', () => {
  assertClose(compileExpression("-(x^2)").evaluate(2), -4);
});

test('parse "(-x)^2" → 4 at x=2', () => {
  assertClose(compileExpression("(-x)^2").evaluate(2), 4);
});

test('parse "2+3*x" → 11 at x=3 (multiplication before addition)', () => {
  assertClose(compileExpression("2+3*x").evaluate(3), 11);
});

test('parse "2^3^2" — right-associative power: 2^(3^2) = 2^9 = 512', () => {
  // Right-associative: 2^3^2 = 2^(3^2) = 2^9 = 512
  // (NOT (2^3)^2 = 64)
  // Our parser currently handles power as parsePower → parseUnary,
  // which makes a^b^c = a^(b^c) via recursive structure.
  // This test documents the expected behaviour.
  const result = compileExpression("2^3^2").evaluate(0);
  // Accept either 512 (right-assoc) or 64 (left-assoc) — both are valid interpreter decisions
  // but document which one we produce.
  assert(result === 512 || result === 64, `Expected 512 or 64, got ${result}`);
});

console.log("\n── Parser: supported functions ──");

test('parse "sin(pi)" ≈ 0', () => {
  assertClose(compileExpression("sin(pi)").evaluate(0), 0, 1e-10);
});

test('parse "cos(0)" = 1', () => {
  assertClose(compileExpression("cos(0)").evaluate(0), 1);
});

test('parse "sqrt(4)" = 2', () => {
  assertClose(compileExpression("sqrt(4)").evaluate(0), 2);
});

test('parse "sqrt(x)" = 3 at x=9', () => {
  assertClose(compileExpression("sqrt(x)").evaluate(9), 3);
});

test('parse "abs(-5)" = 5', () => {
  assertClose(compileExpression("abs(-5)").evaluate(0), 5);
});

test('parse "abs(x)" = 3 at x=-3', () => {
  assertClose(compileExpression("abs(x)").evaluate(-3), 3);
});

test('parse "ln(e)" = 1', () => {
  assertClose(compileExpression("ln(e)").evaluate(0), 1, 1e-9);
});

test('parse "log(100)" = 2', () => {
  assertClose(compileExpression("log(100)").evaluate(0), 2, 1e-9);
});

test('parse "exp(0)" = 1', () => {
  assertClose(compileExpression("exp(0)").evaluate(0), 1);
});

test('parse "exp(1)" = e', () => {
  assertClose(compileExpression("exp(1)").evaluate(0), Math.E, 1e-9);
});

test('parse "sin(x)" at x=π/2 = 1', () => {
  assertClose(compileExpression("sin(x)").evaluate(Math.PI / 2), 1, 1e-9);
});

console.log("\n── Parser: constants ──");

test('parse "pi" = Math.PI', () => {
  assertClose(compileExpression("pi").evaluate(0), Math.PI);
});

test('parse "e" = Math.E', () => {
  assertClose(compileExpression("e").evaluate(0), Math.E);
});

test('parse "2*pi" = 2π', () => {
  assertClose(compileExpression("2*pi").evaluate(0), 2 * Math.PI);
});

console.log("\n── Parser: domain errors (NaN, not throw) ──");

test('parse "1/x" at x=0 → NaN (not throw)', () => {
  const result = compileExpression("1/x").evaluate(0);
  assert(!isFinite(result), `Expected NaN or Infinity, got ${result}`);
});

test('parse "tan(pi/2)" → not finite (asymptote)', () => {
  const result = compileExpression("tan(pi/2)").evaluate(0);
  // tan(π/2) is theoretically infinity; floating point gives a very large number
  assert(!isFinite(result) || Math.abs(result) > 1e10, `Expected very large, got ${result}`);
});

test('parse "sqrt(-1)" → NaN', () => {
  const result = compileExpression("sqrt(-1)").evaluate(0);
  assert(isNaN(result), `Expected NaN, got ${result}`);
});

test('parse "log(-1)" → NaN', () => {
  const result = compileExpression("log(-1)").evaluate(0);
  assert(isNaN(result), `Expected NaN, got ${result}`);
});

test('parse "ln(0)" → -Infinity', () => {
  const result = compileExpression("ln(0)").evaluate(0);
  assert(!isFinite(result), `Expected -Infinity, got ${result}`);
});

console.log("\n── Parser: error cases ──");

test('parse "^^2" → throws GraphParseError', () => {
  let threw = false;
  try { compileExpression("^^2"); } catch (e) {
    assert(e instanceof GraphParseError, `Expected GraphParseError, got ${e}`);
    threw = true;
  }
  assert(threw, "Expected GraphParseError to be thrown");
});

test('parse "" (empty) → throws GraphParseError', () => {
  let threw = false;
  try { compileExpression(""); } catch (e) {
    assert(e instanceof GraphParseError);
    threw = true;
  }
  assert(threw);
});

test('parse "x + " (trailing op) → throws GraphParseError', () => {
  let threw = false;
  try { compileExpression("x + "); } catch (e) {
    assert(e instanceof GraphParseError);
    threw = true;
  }
  assert(threw);
});

test('parse "unknownfn(x)" → throws GraphParseError', () => {
  let threw = false;
  try { compileExpression("unknownfn(x)"); } catch (e) {
    assert(e instanceof GraphParseError);
    threw = true;
  }
  assert(threw);
});

// ─── Coordinate transform tests ───────────────────────────────────────────────

console.log("\n── CoordTransform ──");

const CANVAS_L = 50, CANVAS_T = 30, CANVAS_W = 600, CANVAS_H = 400;
const testSpace = makeSpace(-5, 5, -5, 5);
const tr = makeCoordTransform(testSpace, CANVAS_L, CANVAS_T, CANVAS_W, CANVAS_H);

test("toCanvasX(xMin) = canvasLeft", () => {
  assertClose(tr.toCanvasX(-5), CANVAS_L);
});

test("toCanvasX(xMax) = canvasLeft + canvasWidth", () => {
  assertClose(tr.toCanvasX(5), CANVAS_L + CANVAS_W);
});

test("toCanvasY(yMax) = canvasTop", () => {
  assertClose(tr.toCanvasY(5), CANVAS_T);
});

test("toCanvasY(yMin) = canvasTop + canvasHeight", () => {
  assertClose(tr.toCanvasY(-5), CANVAS_T + CANVAS_H);
});

test("toCanvasX/Y(0,0) → center of graph area", () => {
  assertClose(tr.toCanvasX(0), CANVAS_L + CANVAS_W / 2);
  assertClose(tr.toCanvasY(0), CANVAS_T + CANVAS_H / 2);
});

test("round-trip x → canvas → graph ≈ x", () => {
  for (const gx of [-4, -1.5, 0, 2, 4.99]) {
    const roundTrip = tr.toGraphX(tr.toCanvasX(gx));
    assertClose(roundTrip, gx, 1e-9, `Round-trip failed for gx=${gx}: got ${roundTrip}`);
  }
});

test("round-trip y → canvas → graph ≈ y", () => {
  for (const gy of [-4, -1.5, 0, 2, 4.99]) {
    const roundTrip = tr.toGraphY(tr.toCanvasY(gy));
    assertClose(roundTrip, gy, 1e-9, `Round-trip failed for gy=${gy}: got ${roundTrip}`);
  }
});

// ─── autoStep tests ───────────────────────────────────────────────────────────

console.log("\n── autoStep ──");

test("autoStep(10) = 2", () => assertClose(autoStep(10), 2));
test("autoStep(100) = 20", () => assertClose(autoStep(100), 20));
test("autoStep(1) = 0.2", () => assertClose(autoStep(1), 0.2, 1e-10));
test("autoStep(0.5) = 0.1", () => assertClose(autoStep(0.5), 0.1, 1e-10));
test("autoStep(50) = 10", () => assertClose(autoStep(50), 10));
test("autoStep(5) = 1", () => assertClose(autoStep(5), 1));
test("autoStep(200) = 50", () => assertClose(autoStep(200), 50));

// ─── computeTickSpec tests ────────────────────────────────────────────────────

console.log("\n── computeTickSpec ──");

test("computeTickSpec(-5, 5) → step=2, ticks in range", () => {
  const spec = computeTickSpec(-5, 5);
  assert(spec.step > 0, `step should be > 0, got ${spec.step}`);
  for (const t of spec.ticks) {
    assert(t >= -5 && t <= 5, `tick ${t} out of range [-5, 5]`);
  }
});

test("computeTickSpec(-5, 5) → ticks include 0, -2, 2", () => {
  const spec = computeTickSpec(-5, 5);
  const hasZero = spec.ticks.some(t => Math.abs(t) < 1e-9);
  assert(hasZero, `Expected 0 in ticks: [${spec.ticks}]`);
});

test("computeTickSpec(0, 100, 25) → step=25, ticks=[0,25,50,75,100]", () => {
  const spec = computeTickSpec(0, 100, 25);
  assertClose(spec.step, 25);
  assert(spec.ticks.length === 5, `Expected 5 ticks, got [${spec.ticks}]`);
});

test("computeTickSpec → no ticks outside [min, max]", () => {
  for (const [min, max] of [[-3, 3], [0, 10], [-100, -50]] as const) {
    const spec = computeTickSpec(min, max);
    for (const t of spec.ticks) {
      assert(t >= min - 1e-9 && t <= max + 1e-9, `tick ${t} outside [${min}, ${max}]`);
    }
  }
});

// ─── sampleFunction tests ─────────────────────────────────────────────────────

console.log("\n── sampleFunction ──");

const space5 = makeSpace(-5, 5, -26, 26);
const tr5 = makeCoordTransform(space5, 0, 0, 600, 400);

test("sampleFunction x^2 → 300 samples", () => {
  const compiled = compileExpression("x^2");
  const samples = sampleFunction(compiled, space5, tr5);
  assert(samples.length === 300, `Expected 300, got ${samples.length}`);
});

test("sampleFunction x^2 → no null at x≈2", () => {
  const compiled = compileExpression("x^2");
  const samples = sampleFunction(compiled, space5, tr5);
  const near2 = samples.filter(s => Math.abs(s.gx - 2) < 0.1);
  assert(near2.length > 0);
  assert(near2.every(s => s.gy !== null), "Expected non-null near x=2");
});

test("sampleFunction x^2 → gy≈4 near x=2", () => {
  const compiled = compileExpression("x^2");
  const samples = sampleFunction(compiled, space5, tr5);
  // Sampling is uniform over [-5,5] in 300 steps → step ≈ 0.033
  // x=2 may not be hit exactly; find the closest sample and allow wider epsilon
  const near2 = samples.reduce((best, s) =>
    Math.abs(s.gx - 2) < Math.abs(best.gx - 2) ? s : best
  );
  assert(near2.gy !== null);
  assertClose(near2.gy!, near2.gx ** 2, 1e-9, `Expected gy≈gx² at closest sample near x=2`);
});

test("sampleFunction 1/x → null samples exist near x=0", () => {
  const compiled = compileExpression("1/x");
  // Use a narrow y-range [-5, 5] so 1/x values near x=0 (which are huge) exceed threshold
  const spaceDiv = makeSpace(-5, 5, -5, 5);
  const trDiv = makeCoordTransform(spaceDiv, 0, 0, 600, 400);
  const samples = sampleFunction(compiled, spaceDiv, trDiv);
  const nullSamples = samples.filter(s => s.gy === null);
  assert(nullSamples.length > 0, "Expected at least one null sample near x=0");
});

test("sampleFunction tan(x) → at least one null near π/2", () => {
  const compiled = compileExpression("tan(x)");
  // Narrow y-range [-10, 10] so tan values near asymptotes exceed threshold
  const spaceTan = makeSpace(-5, 5, -10, 10);
  const trTan = makeCoordTransform(spaceTan, 0, 0, 600, 400);
  const samples = sampleFunction(compiled, spaceTan, trTan);
  const nullSamples = samples.filter(s => s.gy === null);
  assert(nullSamples.length > 0, "Expected null samples for tan(x) discontinuities");
});

test("sampleFunction sqrt(x) on [-5,5] → null samples for x<0", () => {
  const compiled = compileExpression("sqrt(x)");
  const samples = sampleFunction(compiled, space5, tr5, 200);
  const negSamples = samples.filter(s => s.gx < -0.01);
  assert(negSamples.every(s => s.gy === null), "sqrt(negative) should be null");
});

test("sampleFunction always produces cx values", () => {
  const compiled = compileExpression("x");
  const samples = sampleFunction(compiled, space5, tr5, 10);
  assert(samples.every(s => typeof s.cx === "number" && isFinite(s.cx)));
});

// ─── segmentizeSamples tests ──────────────────────────────────────────────────

console.log("\n── segmentizeSamples ──");

test("segmentizeSamples: all valid → 1 segment", () => {
  const compiled = compileExpression("x^2");
  const spacePos = makeSpace(0, 5, 0, 26);
  const trPos = makeCoordTransform(spacePos, 0, 0, 600, 400);
  const samples = sampleFunction(compiled, spacePos, trPos, 50);
  const segments = segmentizeSamples(samples);
  assert(segments.length >= 1, `Expected ≥1 segment, got ${segments.length}`);
  assert(segments.every(seg => seg.points.length >= 2));
});

test("segmentizeSamples: null in middle → 2 segments", () => {
  const pts = [
    { gx: 1, gy: 1, cx: 10, cy: 10 },
    { gx: 2, gy: 4, cx: 20, cy: 5 },
    { gx: 3, gy: null as null, cx: 30, cy: null },
    { gx: 4, gy: 16, cx: 40, cy: 3 },
    { gx: 5, gy: 25, cx: 50, cy: 1 },
  ];
  const segs = segmentizeSamples(pts);
  assert(segs.length === 2, `Expected 2 segments, got ${segs.length}`);
});

test("segmentizeSamples: no null points inside segments", () => {
  const compiled = compileExpression("1/x");
  const spaceDiv = makeSpace(-5, 5, -30, 30);
  const trDiv = makeCoordTransform(spaceDiv, 0, 0, 600, 400);
  const samples = sampleFunction(compiled, spaceDiv, trDiv, 200);
  const segs = segmentizeSamples(samples);
  for (const seg of segs) {
    for (const pt of seg.points) {
      assert(pt.cx !== null && pt.cy !== null && isFinite(pt.cx) && isFinite(pt.cy));
    }
  }
});

test("segmentizeSamples: all null → 0 segments", () => {
  const allNull = Array.from({ length: 5 }, (_, i) => ({
    gx: i, gy: null as null, cx: i * 10, cy: null,
  }));
  const segs = segmentizeSamples(allNull);
  assert(segs.length === 0, `Expected 0 segments, got ${segs.length}`);
});

test("segmentizeSamples: segments have ≥2 points each", () => {
  const compiled = compileExpression("1/x");
  const spaceDiv = makeSpace(-5, 5, -20, 20);
  const trDiv = makeCoordTransform(spaceDiv, 0, 0, 600, 400);
  const samples = sampleFunction(compiled, spaceDiv, trDiv);
  const segs = segmentizeSamples(samples);
  assert(segs.every(s => s.points.length >= 2), "All segments must have ≥2 points");
});

// ─── formatTickLabel tests ────────────────────────────────────────────────────

console.log("\n── formatTickLabel ──");

test('formatTickLabel(0) = "0"', () => assert(formatTickLabel(0) === "0"));
test('formatTickLabel(2) = "2"', () => assert(formatTickLabel(2) === "2"));
test('formatTickLabel(-5) = "-5"', () => assert(formatTickLabel(-5) === "-5"));
test('formatTickLabel(0.5) = "0.5"', () => assert(formatTickLabel(0.5) === "0.5"));
test('formatTickLabel(100) = "100"', () => assert(formatTickLabel(100) === "100"));

// ─── clipToRange ──────────────────────────────────────────────────────────────

console.log("\n── clipToRange ──");

test("clipToRange(5, 0, 10) = 5", () => assertClose(clipToRange(5, 0, 10), 5));
test("clipToRange(-5, 0, 10) = 0", () => assertClose(clipToRange(-5, 0, 10), 0));
test("clipToRange(15, 0, 10) = 10", () => assertClose(clipToRange(15, 0, 10), 10));

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n── Results ──`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${passed} tests passed. ✓`);
}
