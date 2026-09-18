/**
 * tests/test-block-serialization.ts
 *
 * Automated verification suite for the Phase 1 Block-Document Core & Serialization Engine.
 *
 * Verifies:
 * 1. Round-trip idempotency: htmlToBlocks(blocksToHtml(blocks)) preserves all blocks,
 *    their stable IDs, types, content, and ordering.
 * 2. Multiple Math blocks: Each Math block maintains independent stable IDs, natural expressions,
 *    and compiled LaTeX without cross-contamination.
 * 3. Table block fidelity: Full HTML structure, rows, columns, styles, alignments survive conversion.
 * 4. Graph block fidelity: GraphDefinition JSON specification survives round-trip intact.
 * 5. Legacy HTML compatibility: Unadorned legacy documents (no data-block-id, no data-block-type)
 *    convert cleanly into typed blocks without losing text, math, tables, or graphs.
 * 6. Downstream handwriting compatibility: Output HTML contains class="math-block", data-latex,
 *    and data-graph-definition attributes required by parse.ts.
 * 7. Graceful empty state handling.
 */

import {
  type DocumentBlock,
  type TextBlock,
  type MathBlock,
  type TableBlock,
  type GraphBlock,
  createEmptyTextBlock,
  createMathBlock,
  createTableBlock,
  createGraphBlock,
} from "../src/types/document";
import {
  blocksToHtml,
  htmlToBlocks,
  escapeAttr,
  unescapeAttr,
} from "../src/lib/editor/blockSerialization";
import { parseHtmlContent } from "../src/lib/handwriting/parse";
import type { GraphDefinition } from "../src/lib/graph/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    console.error(`    Expected: ${JSON.stringify(expected)}`);
    console.error(`    Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log("\n─── 1. Basic Block Creation & Typing ───");

const txtBlock = createEmptyTextBlock("<p>Hello world</p>");
assert(txtBlock.id.startsWith("txt_"), "TextBlock has prefix txt_");
assertEquals(txtBlock.type, "text", "TextBlock type is 'text'");
assertEquals(txtBlock.html, "<p>Hello world</p>", "TextBlock HTML matches");

const mathBlock = createMathBlock("Z1 = X1 W11 + X2 W21", "Z_1 = X_1 W_{11} + X_2 W_{21}", "block");
assert(mathBlock.id.startsWith("math_"), "MathBlock has prefix math_");
assertEquals(mathBlock.type, "math", "MathBlock type is 'math'");
assertEquals(mathBlock.naturalExpr, "Z1 = X1 W11 + X2 W21", "Natural expression preserved");
assertEquals(mathBlock.latex, "Z_1 = X_1 W_{11} + X_2 W_{21}", "LaTeX expression preserved");
assertEquals(mathBlock.displayMode, "block", "DisplayMode preserved");

const tableHtml = '<table class="my-3 w-full border-collapse border"><thead><tr><th data-align="center">Col 1</th></tr></thead><tbody><tr><td>Val 1</td></tr></tbody></table>';
const tableBlock = createTableBlock(tableHtml);
assert(tableBlock.id.startsWith("tbl_"), "TableBlock has prefix tbl_");
assertEquals(tableBlock.type, "table", "TableBlock type is 'table'");

const sampleGraphDef: GraphDefinition = {
  id: "grp_test_1",
  type: "function",
  title: "Parabola Plot",
  xLabel: "x",
  yLabel: "y",
  space: {
    xMin: -5,
    xMax: 5,
    yMin: -2,
    yMax: 10,
    showGrid: true,
    showAxisLabels: true,
    originVisible: true,
  },
  functions: [{ expression: "x^2", label: "y = x²", color: "#1e3a8a" }],
};
const graphBlock = createGraphBlock(sampleGraphDef);
assert(graphBlock.id.startsWith("grp_"), "GraphBlock has prefix grp_");
assertEquals(graphBlock.type, "graph", "GraphBlock type is 'graph'");
assertEquals(graphBlock.graphDef.title, "Parabola Plot", "GraphDefinition title preserved");

console.log("\n─── 2. Round-Trip Serialization Idempotency ───");

const originalBlocks: DocumentBlock[] = [
  txtBlock,
  mathBlock,
  createEmptyTextBlock("<p>Next step computes the weight matrix:</p>"),
  tableBlock,
  createMathBlock("W11 = -1, W12 = 2", "W_{11} = -1,\\quad W_{12} = 2", "compact"),
  graphBlock,
];

const serializedHtml = blocksToHtml(originalBlocks);
assert(typeof serializedHtml === "string" && serializedHtml.length > 0, "Serialized HTML is non-empty string");

// Verify data attributes in serialized HTML
assert(serializedHtml.includes(`data-block-id="${txtBlock.id}"`), "HTML contains txtBlock id");
assert(serializedHtml.includes(`data-block-id="${mathBlock.id}"`), "HTML contains mathBlock id");
assert(serializedHtml.includes(`data-block-id="${tableBlock.id}"`), "HTML contains tableBlock id");
assert(serializedHtml.includes(`data-block-id="${graphBlock.id}"`), "HTML contains graphBlock id");
assert(serializedHtml.includes('class="math-block"'), "HTML contains math-block class for parse.ts compatibility");
assert(serializedHtml.includes('class="graph-block"'), "HTML contains graph-block class for parse.ts compatibility");
assert(serializedHtml.includes('data-latex='), "HTML contains data-latex for parse.ts compatibility");
assert(serializedHtml.includes('data-graph-definition='), "HTML contains data-graph-definition for parse.ts compatibility");

// Deserialization
const deserializedBlocks = htmlToBlocks(serializedHtml);
assertEquals(deserializedBlocks.length, originalBlocks.length, "Round-trip preserves block count (6 blocks)");

// Verify block properties
for (let i = 0; i < originalBlocks.length; i++) {
  const orig = originalBlocks[i]!;
  const restored = deserializedBlocks[i]!;

  assertEquals(restored.id, orig.id, `Block ${i} stable ID preserved (${orig.id})`);
  assertEquals(restored.type, orig.type, `Block ${i} type preserved (${orig.type})`);

  if (orig.type === "text") {
    const rTxt = restored as TextBlock;
    assertEquals(rTxt.html, orig.html, `Block ${i} TextBlock HTML preserved`);
  } else if (orig.type === "math") {
    const rMath = restored as MathBlock;
    assertEquals(rMath.naturalExpr, orig.naturalExpr, `Block ${i} MathBlock naturalExpr preserved`);
    assertEquals(rMath.latex, orig.latex, `Block ${i} MathBlock latex preserved`);
    assertEquals(rMath.displayMode, orig.displayMode, `Block ${i} MathBlock displayMode preserved`);
  } else if (orig.type === "table") {
    const rTbl = restored as TableBlock;
    assertEquals(rTbl.html, orig.html, `Block ${i} TableBlock html preserved`);
  } else if (orig.type === "graph") {
    const rGrp = restored as GraphBlock;
    assertEquals(rGrp.graphDef.id, orig.graphDef.id, `Block ${i} GraphDef ID preserved`);
    assertEquals(rGrp.graphDef.title, orig.graphDef.title, `Block ${i} GraphDef title preserved`);
    assertEquals(rGrp.graphDef.functions?.[0]?.expression, "x^2", `Block ${i} GraphDef function preserved`);
  }
}

// Second round-trip (Idempotency: blocksToHtml(htmlToBlocks(blocksToHtml(blocks))) == blocksToHtml(blocks))
const reSerializedHtml = blocksToHtml(deserializedBlocks);
assertEquals(reSerializedHtml, serializedHtml, "Serialization is 100% idempotent across multiple cycles");

console.log("\n─── 3. Multiple Math Blocks Independence ───");

const m1 = createMathBlock("Z1 = X1 W11", "Z_1 = X_1 W_{11}", "block");
const m2 = createMathBlock("x^2 + y^2 = r^2", "x^2 + y^2 = r^2", "block");
const m3 = createMathBlock("W11 = -1", "W_{11} = -1", "compact");

const multiMathDoc: DocumentBlock[] = [
  createEmptyTextBlock("<p>Equation 1:</p>"),
  m1,
  createEmptyTextBlock("<p>Equation 2:</p>"),
  m2,
  createEmptyTextBlock("<p>Equation 3:</p>"),
  m3,
];

const multiHtml = blocksToHtml(multiMathDoc);
const restoredMulti = htmlToBlocks(multiHtml);

assertEquals(restoredMulti.length, 6, "Multiple math document has 6 blocks");
const restoredM1 = restoredMulti[1] as MathBlock;
const restoredM2 = restoredMulti[3] as MathBlock;
const restoredM3 = restoredMulti[5] as MathBlock;

assertEquals(restoredM1.id, m1.id, "M1 retains unique ID");
assertEquals(restoredM2.id, m2.id, "M2 retains unique ID");
assertEquals(restoredM3.id, m3.id, "M3 retains unique ID");

assert(restoredM1.id !== restoredM2.id, "M1 and M2 have distinct IDs");
assert(restoredM2.id !== restoredM3.id, "M2 and M3 have distinct IDs");

assertEquals(restoredM1.naturalExpr, "Z1 = X1 W11", "M1 formula intact");
assertEquals(restoredM2.naturalExpr, "x^2 + y^2 = r^2", "M2 formula intact");
assertEquals(restoredM3.naturalExpr, "W11 = -1", "M3 formula intact");

console.log("\n─── 4. Legacy HTML Migration (Existing Documents Compatibility) ───");

const legacyHtml = `
  <h1>Assignment 1: Calculus</h1>
  <p>Given the derivative definition:</p>
  <div class="math-block" data-latex="\\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}" contenteditable="false">
    \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}
  </div>
  <p>Consider the table of values below:</p>
  <table class="my-3 w-full border-collapse border border-border text-sm">
    <thead>
      <tr><th style="text-align: left;">x</th><th style="text-align: right;">f(x)</th></tr>
    </thead>
    <tbody>
      <tr><td>0</td><td style="text-align: right;">1</td></tr>
      <tr><td>1</td><td style="text-align: right;">3</td></tr>
    </tbody>
  </table>
  <p>Now observe the function graph:</p>
  <div class="graph-block" data-graph-definition="${escapeAttr(JSON.stringify(sampleGraphDef))}" contenteditable="false">
    <div class="graph-placeholder">[Graph: Parabola Plot]</div>
  </div>
  <p>Final conclusion here.</p>
`;

const migratedBlocks = htmlToBlocks(legacyHtml);

assert(migratedBlocks.length >= 7, `Migrated legacy HTML produced ${migratedBlocks.length} blocks`);

const legacyHeading = migratedBlocks[0] as TextBlock;
assertEquals(legacyHeading.type, "text", "Block 0 is TextBlock");
assert(legacyHeading.html.includes("Assignment 1: Calculus"), "Heading text preserved");
assert(legacyHeading.id.startsWith("txt_") || legacyHeading.id.startsWith("blk_"), "Assigned stable block ID");

const legacyMath = migratedBlocks.find((b) => b.type === "math") as MathBlock;
assert(Boolean(legacyMath), "Legacy math block successfully detected");
assertEquals(legacyMath.latex, "\\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}", "Legacy LaTeX formula preserved");
assert(legacyMath.id.length > 0, "Legacy math block given stable ID");

const legacyTable = migratedBlocks.find((b) => b.type === "table") as TableBlock;
assert(Boolean(legacyTable), "Legacy table block successfully detected");
assert(legacyTable.html.includes("<table"), "Table HTML preserved");
assert(legacyTable.html.includes("<th>x</th>") || legacyTable.html.includes("<th style="), "Table header cells preserved");

const legacyGraph = migratedBlocks.find((b) => b.type === "graph") as GraphBlock;
assert(Boolean(legacyGraph), "Legacy graph block successfully detected");
assertEquals(legacyGraph.graphDef.title, "Parabola Plot", "Legacy GraphDefinition parsed cleanly");

console.log("\n─── 5. Downstream Handwriting Pipeline Compatibility (parse.ts) ───");

// Feed serialized blocks into the existing parseHtmlContent engine
const layoutBlocks = parseHtmlContent(serializedHtml);
assert(layoutBlocks.length > 0, `parseHtmlContent produced ${layoutBlocks.length} layout blocks`);

const hasMathKind = layoutBlocks.some((b) => b.kind === "math" && b.math?.latex.includes("Z_1"));
assert(hasMathKind, "parseHtmlContent recognized MathBlock data from serialized HTML");

const hasTableKind = layoutBlocks.some((b) => b.kind === "table" && b.table?.rows.length);
assert(hasTableKind, "parseHtmlContent recognized TableBlock data from serialized HTML");

const hasGraphKind = layoutBlocks.some((b) => b.kind === "graph" && b.graph?.definition.title === "Parabola Plot");
assert(hasGraphKind, "parseHtmlContent recognized GraphBlock data from serialized HTML");

console.log("\n─── 6. Edge Cases & Resilience ───");

const emptyResult = htmlToBlocks("");
assertEquals(emptyResult.length, 1, "Empty string yields 1 empty TextBlock");
assertEquals(emptyResult[0]?.type, "text", "Empty string block is TextBlock");

const whitespaceResult = htmlToBlocks("   \n\t  ");
assertEquals(whitespaceResult.length, 1, "Whitespace yields 1 empty TextBlock");

const corruptedGraphHtml = '<div data-block-id="blk_bad_grp" data-block-type="graph" data-graph-definition="INVALID_JSON"></div>';
const recoveredGraphDoc = htmlToBlocks(corruptedGraphHtml);
assertEquals(recoveredGraphDoc.length, 1, "Corrupted graph JSON safely caught");
assertEquals(recoveredGraphDoc[0]?.type, "graph", "Fallback graph block created without throwing");

console.log("\n══════════════════════════════════════");
console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All serialization tests passed! ✓\n");
}
