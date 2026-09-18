/**
 * tests/test-graph-layout.ts
 *
 * Automated tests for Phase 2: Graph Layout Engine.
 */

import {
  layoutGraph,
  GRAPH_PADDING_TOP,
  GRAPH_PADDING_LEFT,
  DEFAULT_GRAPH_AREA_WIDTH,
  DEFAULT_GRAPH_AREA_HEIGHT,
} from "../src/lib/graph/layout";
import type { GraphDefinition } from "../src/lib/graph/types";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e?.message ?? e}`);
    failed++;
  }
}

function assert(condition: boolean, message?: string) {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

const baseDef: GraphDefinition = {
  id: "test-def-1",
  type: "coordinate",
  space: {
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    showGrid: true,
    showAxisLabels: true,
    originVisible: true,
  },
};

console.log("\n── Graph Layout Tests ──");

test("layoutGraph with default dimensions → lineUnits ≥ 1", () => {
  const box = layoutGraph(baseDef, 32);
  assert(box.lineUnits >= 1, `Expected lineUnits >= 1, got ${box.lineUnits}`);
});

test("layoutGraph with title → totalHeight > without title", () => {
  const boxNoTitle = layoutGraph(baseDef, 32);
  const boxWithTitle = layoutGraph({ ...baseDef, title: "My Graph" }, 32);
  assert(
    boxWithTitle.height > boxNoTitle.height,
    `Expected boxWithTitle (${boxWithTitle.height}) > boxNoTitle (${boxNoTitle.height})`,
  );
});

test("layoutGraph without title → totalHeight ≤ with title", () => {
  const boxNoTitle = layoutGraph(baseDef, 32);
  const boxWithTitle = layoutGraph({ ...baseDef, title: "Title" }, 32);
  assert(boxNoTitle.height <= boxWithTitle.height);
});

test("layoutGraph with xLabel → totalHeight > without xLabel", () => {
  const boxNoLabel = layoutGraph(baseDef, 32);
  const boxWithLabel = layoutGraph({ ...baseDef, xLabel: "Time (s)" }, 32);
  assert(
    boxWithLabel.height > boxNoLabel.height,
    `Expected boxWithLabel (${boxWithLabel.height}) > boxNoLabel (${boxNoLabel.height})`,
  );
});

test("layoutGraph with yLabel → totalWidth > without yLabel", () => {
  const boxNoLabel = layoutGraph(baseDef, 32);
  const boxWithLabel = layoutGraph({ ...baseDef, yLabel: "Velocity (m/s)" }, 32);
  assert(
    boxWithLabel.width > boxNoLabel.width,
    `Expected boxWithLabel (${boxWithLabel.width}) > boxNoLabel (${boxNoLabel.width})`,
  );
});

test("lineUnits = ceil(totalHeight / rulingSpacing) exactly", () => {
  const ruling = 28;
  const box = layoutGraph(baseDef, ruling);
  const expected = Math.max(1, Math.ceil(box.height / ruling));
  assert(box.lineUnits === expected, `Expected ${expected}, got ${box.lineUnits}`);
});

test("lineUnits ≥ 1 even for tiny rulingSpacing", () => {
  const box = layoutGraph(baseDef, 2);
  assert(box.lineUnits >= 1);
});

test("graphArea.left = yLabelWidth + GRAPH_PADDING_LEFT", () => {
  const boxNoLabel = layoutGraph(baseDef, 32);
  assert(boxNoLabel.graphArea.left === GRAPH_PADDING_LEFT);

  const boxWithLabel = layoutGraph({ ...baseDef, yLabel: "y" }, 32);
  assert(boxWithLabel.graphArea.left === 28 + GRAPH_PADDING_LEFT);
});

test("graphArea.top = GRAPH_PADDING_TOP + titleHeight", () => {
  const boxNoTitle = layoutGraph(baseDef, 32);
  assert(boxNoTitle.graphArea.top === GRAPH_PADDING_TOP);

  const ruling = 30;
  const boxWithTitle = layoutGraph({ ...baseDef, title: "Title" }, ruling);
  const expectedTop = GRAPH_PADDING_TOP + Math.ceil(ruling * 1.2);
  assert(
    boxWithTitle.graphArea.top === expectedTop,
    `Expected ${expectedTop}, got ${boxWithTitle.graphArea.top}`,
  );
});

test("graphArea.width = graphAreaWidth (default or hint)", () => {
  const box = layoutGraph(baseDef, 32);
  assert(box.graphArea.width === DEFAULT_GRAPH_AREA_WIDTH);
});

test("graphArea.height = graphAreaHeight (default or hint)", () => {
  const box = layoutGraph(baseDef, 32);
  assert(box.graphArea.height === DEFAULT_GRAPH_AREA_HEIGHT);
});

test("widthHint=500 → graphArea.width = 500", () => {
  const box = layoutGraph({ ...baseDef, widthHint: 500 }, 32);
  assert(box.graphArea.width === 500);
});

test("heightHint=300 → graphArea.height = 300", () => {
  const box = layoutGraph({ ...baseDef, heightHint: 300 }, 32);
  assert(box.graphArea.height === 300);
});

test("box.draw executes cleanly with full graph features", () => {
  const fullDef: GraphDefinition = {
    id: "full-test-def",
    type: "function",
    title: "Parabola & Scatter",
    xLabel: "x axis",
    yLabel: "y axis",
    space: {
      xMin: -5,
      xMax: 5,
      yMin: -5,
      yMax: 5,
      showGrid: true,
      showAxisLabels: true,
      originVisible: true,
    },
    functions: [
      { expression: "x^2 - 2", label: "y = x^2 - 2", color: "#e11d48" },
      { expression: "tan(x)", label: "tan(x)" },
    ],
    points: [
      { x: 0, y: 0, label: "Origin", connect: false },
      { x: 2, y: 2, label: "P(2,2)", connect: true },
      { x: 3, y: 3, connect: true },
    ],
    annotations: [
      { x: 1, y: 1, text: "Peak note" },
    ],
  };

  const noop = () => {};
  const mockCtx = new Proxy(
    {
      measureText: (text: string) => ({ width: text.length * 8 }),
      font: "",
    },
    {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        return noop;
      },
      set(target: any, prop: string, value: any) {
        target[prop] = value;
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;

  const box = layoutGraph(fullDef, 32);
  const mockSettings = {
    fontFamily: "Kalam",
    fontSize: 20,
    penWidth: 1.2,
    inkColor: "#1d3fb5",
    inkIntensity: 0.9,
    wordSpacing: 10,
    letterSpacing: 0.5,
    compactness: 1.0,
    lineSpacing: 1.4,
    slant: 0,
    slantVariation: 2,
    charVariation: 1,
    baselineVariation: 1,
    inkVariation: 1,
    imperfection: 1,
    pressure: 0.5,
    writingSpeed: 0.2,
  };

  let drawSuccess = false;
  try {
    box.draw(mockCtx, 40, 100, mockSettings as any, () => 0.5, "#1d3fb5");
    drawSuccess = true;
  } catch (e: any) {
    console.error("box.draw error:", e);
  }
  assert(drawSuccess, "box.draw should execute without throwing");
});

console.log("\n── Results ──");
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\nAll 13 layout tests passed. ✓\n");
}
