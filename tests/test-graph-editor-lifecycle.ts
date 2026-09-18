/**
 * tests/test-graph-editor-lifecycle.ts
 *
 * Automated tests for graph insertion lifecycle, serialization round-trip,
 * and coexistence with math, tables, and formatted text.
 */

import { parseContent, blocksToHtml, htmlToPlainText } from "../src/lib/handwriting/parse";
import { layoutDocument } from "../src/lib/handwriting/layout";
import { DEFAULT_SETTINGS, type HandwritingSettings } from "../src/lib/handwriting/types";
import type { GraphDefinition } from "../src/lib/graph/types";

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

function createMockCanvas(): CanvasRenderingContext2D {
  const noop = () => {};
  return new Proxy(
    {
      measureText: (text: string) => ({ width: text.length * 10 }),
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
}

const ctx = createMockCanvas();
const settings: HandwritingSettings = {
  ...DEFAULT_SETTINGS,
  fontSize: 20,
  lineSpacing: 1.4,
};

function makeGraphBlockHtml(def: GraphDefinition): string {
  const json = JSON.stringify(def).replace(/"/g, "&quot;");
  const title = def.title ?? `${def.type} graph`;
  return `<div class="graph-block" data-graph-definition="${json}" contenteditable="false"><span>📈</span><span>${title}</span></div>`;
}

console.log("\n=== Graph Insertion Lifecycle Tests ===\n");

// 1. Single Graph Insertion
{
  const g1: GraphDefinition = {
    id: "g-1",
    type: "function",
    title: "Parabola",
    space: { xMin: -5, xMax: 5, yMin: -2, yMax: 26, showGrid: true, showAxisLabels: true, originVisible: true },
    functions: [{ expression: "x^2", label: "y=x^2" }],
  };

  const html = `<p>Step 1: Consider the function</p>${makeGraphBlockHtml(g1)}<p>Step 2: Analysis</p>`;
  const blocks = parseContent(html);

  assert(blocks.length === 3, "Parsed into 3 distinct blocks (para, graph, para)");
  assert(blocks[1]?.kind === "graph", "Second block is of kind 'graph'");
  assert(blocks[1]?.graph?.definition.title === "Parabola", "Graph block retains title");
  assert(blocks[1]?.graph?.definition.functions?.[0]?.expression === "x^2", "Graph block retains function expression");

  const doc = layoutDocument(ctx, { content: html, settings });
  const graphPlacement = doc.pages[0]?.placements.find((p) => p.type === "graphBlock");
  assert(graphPlacement !== undefined, "Layout produces a graphBlock placement");
  assert((graphPlacement as any).definition.id === "g-1", "Placement retains graph id");
}

// 2. Round-trip HTML serialization
{
  const gOrig: GraphDefinition = {
    id: "g-roundtrip",
    type: "points",
    title: "Data Series",
    xLabel: "Time (s)",
    yLabel: "Distance (m)",
    space: { xMin: 0, xMax: 10, yMin: 0, yMax: 100, showGrid: true, showAxisLabels: true, originVisible: true },
    points: [
      { x: 0, y: 0, connect: false },
      { x: 5, y: 25, label: "Mid", connect: true },
      { x: 10, y: 100, label: "End", connect: true },
    ],
  };

  const originalHtml = `<p>Initial notes</p>${makeGraphBlockHtml(gOrig)}<p>Final notes</p>`;
  const blocks = parseContent(originalHtml);
  const serializedHtml = blocksToHtml(blocks);
  const restoredBlocks = parseContent(serializedHtml);

  assert(restoredBlocks.length === 3, "Restored blocks length equals 3");
  assert(restoredBlocks[1]?.kind === "graph", "Restored block is graph");
  const restoredDef = restoredBlocks[1]?.graph?.definition;
  assert(restoredDef !== undefined, "Restored definition exists");
  assert(restoredDef?.id === gOrig.id, "Restored graph id matches");
  assert(restoredDef?.title === gOrig.title, "Restored title matches");
  assert(restoredDef?.points?.length === 3, "Restored 3 points intact");
  assert(restoredDef?.points?.[1]?.label === "Mid", "Restored point label matches");
}

// 3. Coexistence of Math Block, Table, and Graph Block in single document
{
  const gDef: GraphDefinition = {
    id: "g-coexist",
    type: "function",
    title: "Trig Wave",
    space: { xMin: -3.14, xMax: 3.14, yMin: -1, yMax: 1, showGrid: true, showAxisLabels: true, originVisible: true },
    functions: [{ expression: "sin(x)", label: "sin(x)" }],
  };

  const mathHtml = `<div class="math-block" data-latex="y = \\sin(x)"><span>y = sin(x)</span></div>`;
  const tableHtml = `<table><tr><th>x</th><th>y</th></tr><tr><td>0</td><td>0</td></tr></table>`;
  const graphHtml = makeGraphBlockHtml(gDef);

  const fullHtml = `<p>Theory:</p>${mathHtml}<p>Data Table:</p>${tableHtml}<p>Visual Graph:</p>${graphHtml}<p>Done.</p>`;
  const blocks = parseContent(fullHtml);

  assert(blocks.length === 7, "Interleaved document parses into 7 distinct blocks");
  assert(blocks[1]?.kind === "math", "Block 1 is math");
  assert(blocks[3]?.kind === "table", "Block 3 is table");
  assert(blocks[5]?.kind === "graph", "Block 5 is graph");

  const doc = layoutDocument(ctx, { content: fullHtml, settings });
  const allPlacements = doc.pages.flatMap((p) => p.placements);
  const mathPlacements = allPlacements.filter((p) => p.type === "mathBlock");
  const tablePlacements = allPlacements.filter((p) => p.type === "tableRow");
  const graphPlacements = allPlacements.filter((p) => p.type === "graphBlock");

  assert(mathPlacements.length === 1, "Layout has math block");
  assert(tablePlacements.length >= 2, "Layout has table rows");
  assert(graphPlacements.length === 1, "Layout has graph block");
}

// 4. htmlToPlainText handles graph blocks
{
  const gDef: GraphDefinition = {
    id: "g-text",
    type: "coordinate",
    space: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, showGrid: false, showAxisLabels: false, originVisible: true },
  };
  const html = `<p>Before</p>${makeGraphBlockHtml(gDef)}<p>After</p>`;
  const plain = htmlToPlainText(html);
  assert(plain.includes("Before"), "Plain text contains Before text");
  assert(plain.includes("[Graph]"), "Plain text contains [Graph] placeholder");
  assert(plain.includes("After"), "Plain text contains After text");
}

console.log("\n── Results ──");
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\nAll graph editor lifecycle tests passed. ✓\n");
}
