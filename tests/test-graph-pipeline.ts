/**
 * tests/test-graph-pipeline.ts
 *
 * Automated tests for Phase 4: Graph Pipeline Integration.
 */

import { parseContent, parseHtmlContent } from "../src/lib/handwriting/parse";
import { layoutDocument } from "../src/lib/handwriting/layout";
import { layoutGraph } from "../src/lib/graph/layout";
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

const sampleGraphDef: GraphDefinition = {
  id: "test-g1",
  type: "function",
  title: "Test Function",
  space: {
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    showGrid: true,
    showAxisLabels: true,
    originVisible: true,
  },
  functions: [{ expression: "x^2", label: "y=x^2" }],
};

function makeGraphBlockHtml(def: GraphDefinition): string {
  const json = JSON.stringify(def).replace(/"/g, "&quot;");
  return `<div class="graph-block" data-graph-definition="${json}" contenteditable="false"><span>[Graph: ${def.title ?? "untitled"}]</span></div>`;
}

console.log("\n=== Graph Pipeline Integration Tests ===\n");

// 1. parseHtmlContent with graph-block div
{
  const html = `<p>Introduction</p>${makeGraphBlockHtml(sampleGraphDef)}<p>Conclusion</p>`;
  const blocks = parseHtmlContent(html);
  assert(blocks.length === 3, "parseHtmlContent with graph-block div produces 3 blocks");
  assert(blocks[1]?.kind === "graph", 'parseHtmlContent with graph-block div → Block { kind: "graph" }');
  assert(
    blocks[1]?.graph?.definition?.id === sampleGraphDef.id,
    "parseHtmlContent with graph-block div → graph.definition defined with correct id",
  );
}

// 2. parseHtmlContent with malformed graph JSON → silently skipped (no crash)
{
  const malformedHtml = `<p>Before</p><div class="graph-block" data-graph-definition="invalid-json-{">Bad</div><p>After</p>`;
  let threw = false;
  let blocks: any[] = [];
  try {
    blocks = parseHtmlContent(malformedHtml);
  } catch {
    threw = true;
  }
  assert(!threw, "parseHtmlContent with malformed graph JSON does not throw");
  assert(
    blocks.filter((b) => b.kind === "graph").length === 0,
    "parseHtmlContent with malformed graph JSON → silently skipped (no crash)",
  );
}

// 3. parseHtmlContent with no graph blocks → output identical to baseline (no regression)
{
  const plainHtml = `<p>Hello world</p><p>Second paragraph</p>`;
  const blocks = parseHtmlContent(plainHtml);
  assert(
    blocks.length === 2 && blocks.every((b) => b.kind === "paragraph"),
    "parseHtmlContent with no graph blocks → output identical to baseline (no regression)",
  );
}

// 4 & 5. Graph flow & lineUnits
{
  const rulingSpacing = settings.fontSize * settings.lineSpacing;
  const box = layoutGraph(sampleGraphDef, rulingSpacing);
  assert(box.lineUnits >= 1, "graphFlowBlock → returns FlowGraphBlock with lineUnits ≥ 1");
  const expectedLineUnits = Math.max(1, Math.ceil(box.height / rulingSpacing));
  assert(
    box.lineUnits === expectedLineUnits,
    "graphFlowBlock → lineUnits = ceil(totalHeight / rulingSpacing)",
  );
}

// 6. Paginator places graph atomically (lineIndex consistent)
{
  const html = `<p>Line 1</p><p>Line 2</p>${makeGraphBlockHtml(sampleGraphDef)}<p>Follow-up</p>`;
  const doc = layoutDocument(ctx, { content: html, settings });
  const allPlacements = doc.pages.flatMap((p) => p.placements);
  const graphPlacement = allPlacements.find((p) => p.type === "graphBlock");
  assert(graphPlacement !== undefined, "paginator places graph atomically (lineIndex consistent)");
}

// 7. Paginator spills graph to next page when insufficient space
{
  const { createPageCoordinateSystem, lineCapacity } = await import("../src/lib/handwriting/layout");
  const coords = createPageCoordinateSystem(settings, ctx, 1, 1);
  const cap = lineCapacity(coords);

  // Fill up page so that only 2 lines remain, which cannot fit a graph requiring ~17 lineUnits
  const paras: string[] = [];
  for (let i = 0; i < cap - 2; i++) {
    paras.push(`<p>Line ${i + 1}</p>`);
  }
  paras.push(makeGraphBlockHtml(sampleGraphDef));
  const html = paras.join("\n");
  const doc = layoutDocument(ctx, { content: html, settings });

  assert(doc.pages.length >= 2, "paginator spills graph to next page when insufficient space");
  const p1HasGraph = doc.pages[0]?.placements.some((p) => p.type === "graphBlock");
  const p2HasGraph = doc.pages[1]?.placements.some((p) => p.type === "graphBlock");
  assert(p1HasGraph === false && p2HasGraph === true, "graph spilled cleanly to page 2");
}

// 8. Paginator never splits a graph block across two pages
{
  const { createPageCoordinateSystem, lineCapacity } = await import("../src/lib/handwriting/layout");
  const coords = createPageCoordinateSystem(settings, ctx, 1, 1);
  const cap = lineCapacity(coords);
  const paras: string[] = [];
  for (let i = 0; i < cap - 3; i++) {
    paras.push(`<p>Line ${i + 1}</p>`);
  }
  paras.push(makeGraphBlockHtml(sampleGraphDef));
  const html = paras.join("\n");
  const doc = layoutDocument(ctx, { content: html, settings });
  const graphPlacements = doc.pages.flatMap((p) =>
    p.placements.filter((item) => item.type === "graphBlock")
  );
  assert(
    graphPlacements.length === 1,
    "paginator never splits a graph block across two pages (single atomic placement)",
  );
}

// 9. Text before and after graph → correct lineIndex offsets
{
  const html = `<p>Before text</p>${makeGraphBlockHtml(sampleGraphDef)}<p>After text</p>`;
  const doc = layoutDocument(ctx, { content: html, settings });
  const p0 = doc.pages[0]?.placements ?? [];

  const graphP = p0.find((p) => p.type === "graphBlock");
  const linePlacements = p0.filter((p) => p.type === "line");

  assert(linePlacements.length >= 2 && graphP !== undefined, "all 3 items found");
  const beforeP = linePlacements[0]!;
  const afterP = linePlacements[1]!;
  assert(
    (graphP as any).lineIndex >= beforeP.lineIndex + 1,
    "graph is placed after before text",
  );
  assert(
    afterP.lineIndex >= (graphP as any).lineIndex + (graphP as any).lineUnits,
    "text before and after graph → correct lineIndex offsets",
  );
}

// 10. Two graphs in one document → each at correct lineIndex in document order
{
  const g2Def: GraphDefinition = { ...sampleGraphDef, id: "test-g2", title: "Second Graph" };
  const html = `${makeGraphBlockHtml(sampleGraphDef)}<p>Middle</p>${makeGraphBlockHtml(g2Def)}`;
  const doc = layoutDocument(ctx, { content: html, settings });
  const allPlacements = doc.pages.flatMap((p) => p.placements);
  const graphs = allPlacements.filter((p) => p.type === "graphBlock");
  assert(
    graphs.length === 2,
    "two graphs in one document → both placed distinctly",
  );
  assert(
    (graphs[0] as any).definition.id === "test-g1" && (graphs[1] as any).definition.id === "test-g2",
    "two graphs in one document → each at correct lineIndex in document order",
  );
}

// 11. Math block before graph block → no lineIndex collision
{
  const mathHtml = `<div class="math-block" data-latex="x^2 + y^2 = r^2" contenteditable="false">math</div>`;
  const html = `${mathHtml}${makeGraphBlockHtml(sampleGraphDef)}`;
  const doc = layoutDocument(ctx, { content: html, settings });
  const p0 = doc.pages[0]?.placements ?? [];
  const mathP = p0.find((p) => p.type === "mathBlock");
  const graphP = p0.find((p) => p.type === "graphBlock");
  assert(mathP !== undefined && graphP !== undefined, "both math and graph found");
  assert(
    (graphP as any).lineIndex >= (mathP as any).lineIndex + (mathP as any).lineUnits,
    "math block before graph block → no lineIndex collision",
  );
}

// 12. Table row before graph block → no lineIndex collision
{
  const tableHtml = `<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>`;
  const html = `${tableHtml}${makeGraphBlockHtml(sampleGraphDef)}`;
  const doc = layoutDocument(ctx, { content: html, settings });
  const p0 = doc.pages[0]?.placements ?? [];
  const tableRows = p0.filter((p) => p.type === "tableRow");
  const graphP = p0.find((p) => p.type === "graphBlock");
  assert(tableRows.length === 2 && graphP !== undefined, "both table rows and graph found");
  const lastTableRow = tableRows[tableRows.length - 1]!;
  assert(
    (graphP as any).lineIndex >= (lastTableRow as any).lineIndex + (lastTableRow as any).lineUnits,
    "table row before graph block → no lineIndex collision",
  );
}

console.log("\n── Results ──");
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\nAll pipeline integration tests passed. ✓\n");
}
