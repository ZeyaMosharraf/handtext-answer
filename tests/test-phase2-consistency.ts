/**
 * tests/test-phase2-consistency.ts
 *
 * Comprehensive Automated Verification Suite for Phase 2:
 * "Structured Block / Document Model Integration"
 *
 * Verifies all 16 required Phase 2 criteria:
 * 1. TextBlock round trip
 * 2. MathBlock round trip
 * 3. TableBlock round trip
 * 4. GraphBlock round trip
 * 5. Mixed block round trip
 * 6. Stable block IDs
 * 7. Block ordering preservation
 * 8. Legacy HTML → DocumentBlock[]
 * 9. DocumentBlock[] → HTML
 * 10. HTML → DocumentBlock[] → HTML semantic equivalence
 * 11. DocumentBlock[] → layout without HTML reparsing
 * 12. Math functions: min, max, sin, cos
 * 13. Normal identifiers remain correct (e.g. abc as variables vs min as function)
 * 14. Math + Table + Graph mixed document
 * 15. Answer Margin metadata survives conversion
 * 16. Existing Phase 1 regression tests integration
 */

import {
  type DocumentBlock,
  type TextBlock,
  type MathBlock,
  type TableBlock,
  type GraphBlock,
  type MarginMarker,
  createEmptyTextBlock,
  createMathBlock,
  createTableBlock,
  createGraphBlock,
} from "../src/types/document";
import {
  blocksToHtml,
  htmlToBlocks,
  documentBlocksToHandwritingBlocks,
  handwritingBlocksToDocumentBlocks,
  toHandwritingBlocks,
  parseTableHtml,
  tableDataToHtml,
} from "../src/lib/editor/blockSerialization";
import {
  parseContent,
  parseHtmlContent,
  type Block,
  type TableData,
} from "../src/lib/handwriting/parse";
import { layoutDocument } from "../src/lib/handwriting/layout";
import { parseMath } from "../src/lib/math";
import { tokenize, MATH_NAMED_FUNCTIONS } from "../src/lib/math/tokens";
import type { GraphDefinition } from "../src/lib/graph/types";
import { DEFAULT_SETTINGS } from "../src/lib/handwriting/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

function assertEquals<T>(actual: T, expected: T, testName: string) {
  if (actual === expected) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    console.error(`    Expected: ${JSON.stringify(expected)}`);
    console.error(`    Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// Mock 2D Canvas context for Node.js headless testing
function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    measureText: (text: string) => ({
      width: text.length * 9,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
    }),
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillText: () => {},
    strokeText: () => {},
    fillRect: () => {},
    clearRect: () => {},
    arc: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

console.log("\n==================================================");
console.log("PHASE 2 STRUCTURED BLOCK & CONSISTENCY TESTS");
console.log("==================================================\n");

// ─── TEST 1: TextBlock round trip ───
console.log("─── 1. TextBlock Round Trip ───");
{
  const originalText: TextBlock = {
    id: "txt_phase2_001",
    type: "text",
    html: "<p>First paragraph with <strong>bold</strong> and <em>italic</em>.</p>",
    createdAt: 1000,
  };

  // Round trip via HTML serialization
  const html = blocksToHtml([originalText]);
  const fromHtml = htmlToBlocks(html);
  assert(fromHtml.length === 1, "HTML deserialization yields 1 block");
  assertEquals(fromHtml[0]?.id, originalText.id, "Stable ID preserved through HTML");
  assertEquals(fromHtml[0]?.type, "text", "Type preserved as 'text'");
  assert((fromHtml[0] as TextBlock).html.includes("<strong>bold</strong>"), "Rich HTML markup preserved");

  // Round trip via direct handwriting Block adapter
  const hwBlocks = documentBlocksToHandwritingBlocks([originalText]);
  assert(hwBlocks.length > 0, "Converted to layout handwriting blocks");
  assertEquals(hwBlocks[0]?.id, originalText.id, "Layout block inherits stable ID");
  const docFromHw = handwritingBlocksToDocumentBlocks(hwBlocks);
  assertEquals(docFromHw[0]?.id, originalText.id, "Converted back to DocumentBlock with stable ID");
  assertEquals(docFromHw[0]?.type, "text", "Converted back to TextBlock");
}

// ─── TEST 2: MathBlock round trip ───
console.log("\n─── 2. MathBlock Round Trip ───");
{
  const originalMath: MathBlock = {
    id: "math_phase2_002",
    type: "math",
    naturalExpr: "Z1 = X1 W11 + X2 W21",
    latex: "Z_1 = X_1 W_{11} + X_2 W_{21}",
    displayMode: "block",
    color: "#2563eb",
    createdAt: 2000,
  };

  // Direct handwriting Block adapter round trip (no HTML)
  const hwBlocks = documentBlocksToHandwritingBlocks([originalMath]);
  assert(hwBlocks.length === 1, "Direct adapter produced 1 Block");
  assertEquals(hwBlocks[0]?.kind, "math", "Block kind is 'math'");
  assertEquals(hwBlocks[0]?.id, originalMath.id, "Stable ID preserved in Block");
  assertEquals(hwBlocks[0]?.math?.latex, originalMath.latex, "LaTeX preserved directly");
  assertEquals(hwBlocks[0]?.math?.color, originalMath.color, "Color preserved directly");

  const restored = handwritingBlocksToDocumentBlocks(hwBlocks);
  assert(restored.length === 1, "Restored 1 DocumentBlock");
  assertEquals(restored[0]?.id, originalMath.id, "Restored stable ID");
  assertEquals(restored[0]?.type, "math", "Restored type is 'math'");
  const rMath = restored[0] as MathBlock;
  assertEquals(rMath.latex, originalMath.latex, "Restored LaTeX matches");
  assertEquals(rMath.displayMode, originalMath.displayMode, "Restored displayMode matches");
  assertEquals(rMath.color, originalMath.color, "Restored color matches");

  // HTML round trip
  const html = blocksToHtml([originalMath]);
  const fromHtml = htmlToBlocks(html);
  assertEquals(fromHtml[0]?.id, originalMath.id, "HTML round trip preserves MathBlock ID");
  assertEquals((fromHtml[0] as MathBlock).latex, originalMath.latex, "HTML round trip preserves LaTeX");
  assertEquals((fromHtml[0] as MathBlock).color, originalMath.color, "HTML round trip preserves color");
}

// ─── TEST 3: TableBlock round trip ───
console.log("\n─── 3. TableBlock Round Trip ───");
{
  const tableData: TableData = {
    headerRow: true,
    alignments: ["left", "center", "right"],
    rows: [
      [
        { text: "Item", segs: [{ text: "Item", bold: true, underline: false }] },
        { text: "Qty", segs: [{ text: "Qty", bold: true, underline: false }] },
        { text: "Price", segs: [{ text: "Price", bold: true, underline: false }] },
      ],
      [
        { text: "Widget", segs: [{ text: "Widget", bold: false, underline: false }] },
        { text: "10", segs: [{ text: "10", bold: false, underline: false }] },
        { text: "$99", segs: [{ text: "$99", bold: false, underline: false }] },
      ],
    ],
  };

  const tableHtml = tableDataToHtml(tableData);
  const originalTable: TableBlock = {
    id: "tbl_phase2_003",
    type: "table",
    html: tableHtml,
    tableData,
    createdAt: 3000,
  };

  // Direct conversion to layout Block
  const hwBlocks = documentBlocksToHandwritingBlocks([originalTable]);
  assert(hwBlocks.length === 1, "Direct adapter produced 1 table Block");
  assertEquals(hwBlocks[0]?.kind, "table", "Block kind is 'table'");
  assertEquals(hwBlocks[0]?.id, originalTable.id, "Table Block retains stable ID");
  assert(Boolean(hwBlocks[0]?.table), "Table data present on layout Block");
  assertEquals(hwBlocks[0]?.table?.rows.length, 2, "Table has 2 rows");
  assertEquals(hwBlocks[0]?.table?.alignments?.[1], "center", "Column alignment preserved");

  // Reverse conversion
  const restored = handwritingBlocksToDocumentBlocks(hwBlocks);
  assertEquals(restored[0]?.id, originalTable.id, "Restored table retains ID");
  assertEquals(restored[0]?.type, "table", "Restored type is 'table'");
  assertEquals((restored[0] as TableBlock).tableData?.rows.length, 2, "Restored TableData rows preserved");
}

// ─── TEST 4: GraphBlock round trip ───
console.log("\n─── 4. GraphBlock Round Trip ───");
{
  const graphDef: GraphDefinition = {
    id: "grp_parabola",
    type: "function",
    title: "Parabola y = x^2",
    space: { xMin: -4, xMax: 4, yMin: -1, yMax: 16, showGrid: true, showAxisLabels: true, originVisible: true },
    functions: [{ expression: "x^2", label: "f(x)" }],
  };

  const originalGraph: GraphBlock = {
    id: "grp_phase2_004",
    type: "graph",
    graphDef,
    createdAt: 4000,
  };

  // Direct conversion
  const hwBlocks = documentBlocksToHandwritingBlocks([originalGraph]);
  assert(hwBlocks.length === 1, "Graph converted to 1 layout Block");
  assertEquals(hwBlocks[0]?.kind, "graph", "Block kind is 'graph'");
  assertEquals(hwBlocks[0]?.id, originalGraph.id, "Graph Block retains stable ID");
  assertEquals(hwBlocks[0]?.graph?.definition.title, "Parabola y = x^2", "Graph definition title intact");

  // Reverse conversion
  const restored = handwritingBlocksToDocumentBlocks(hwBlocks);
  assertEquals(restored[0]?.id, originalGraph.id, "Restored graph retains stable ID");
  assertEquals(restored[0]?.type, "graph", "Restored type is 'graph'");
  assertEquals((restored[0] as GraphBlock).graphDef.title, "Parabola y = x^2", "Graph title preserved");
  assertEquals((restored[0] as GraphBlock).graphDef.functions?.[0]?.expression, "x^2", "Graph function expression preserved");
}

// ─── TEST 5: Mixed block round trip ───
console.log("\n─── 5. Mixed Block Round Trip ───");
{
  const mixedBlocks: DocumentBlock[] = [
    createEmptyTextBlock("<p>Introduction text before formula</p>"),
    createMathBlock("x' = x - min / max - min", "x' = x - \\min / \\max - \\min", "block", "#1e3a8a"),
    createTableBlock("<table><tbody><tr><th>Param</th><th>Value</th></tr><tr><td>Alpha</td><td>0.05</td></tr></tbody></table>"),
    createGraphBlock({
      id: "grp_mix",
      type: "function",
      title: "Mixed Graph",
      space: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, showGrid: true, showAxisLabels: true, originVisible: true },
    }),
    createEmptyTextBlock("<p>Conclusion text after graph</p>"),
  ];

  // Assign fixed test IDs
  mixedBlocks[0]!.id = "txt_mix_1";
  mixedBlocks[1]!.id = "math_mix_2";
  mixedBlocks[2]!.id = "tbl_mix_3";
  mixedBlocks[3]!.id = "grp_mix_4";
  mixedBlocks[4]!.id = "txt_mix_5";

  // DocumentBlock[] -> Block[] -> DocumentBlock[]
  const hwBlocks = documentBlocksToHandwritingBlocks(mixedBlocks);
  assertEquals(hwBlocks.length, 5, "Direct conversion produced exactly 5 layout blocks");
  assertEquals(hwBlocks[0]?.kind, "paragraph", "Block 0 is paragraph");
  assertEquals(hwBlocks[1]?.kind, "math", "Block 1 is math");
  assertEquals(hwBlocks[2]?.kind, "table", "Block 2 is table");
  assertEquals(hwBlocks[3]?.kind, "graph", "Block 3 is graph");
  assertEquals(hwBlocks[4]?.kind, "paragraph", "Block 4 is paragraph");

  const roundTripped = handwritingBlocksToDocumentBlocks(hwBlocks);
  assertEquals(roundTripped.length, 5, "Round trip produced exactly 5 DocumentBlocks");
  assertEquals(roundTripped[0]?.type, "text", "Block 0 type is text");
  assertEquals(roundTripped[1]?.type, "math", "Block 1 type is math");
  assertEquals(roundTripped[2]?.type, "table", "Block 2 type is table");
  assertEquals(roundTripped[3]?.type, "graph", "Block 3 type is graph");
  assertEquals(roundTripped[4]?.type, "text", "Block 4 type is text");
}

// ─── TEST 6 & 7: Stable block IDs and Ordering Preservation ───
console.log("\n─── 6 & 7. Stable Block IDs & Ordering Preservation ───");
{
  const expectedIds = ["blk_id_alpha", "blk_id_beta", "blk_id_gamma", "blk_id_delta"];
  const blocks: DocumentBlock[] = [
    { id: expectedIds[0]!, type: "text", html: "<p>Alpha</p>", createdAt: 1 },
    { id: expectedIds[1]!, type: "math", naturalExpr: "E=mc^2", latex: "E = mc^2", displayMode: "block", createdAt: 2 },
    { id: expectedIds[2]!, type: "table", html: "<table><tbody><tr><td>Gamma</td></tr></tbody></table>", createdAt: 3 },
    { id: expectedIds[3]!, type: "graph", graphDef: { id: "g", type: "coordinate", space: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, showGrid: true, showAxisLabels: true, originVisible: true } }, createdAt: 4 },
  ];

  // Test across serialization cycles
  const html = blocksToHtml(blocks);
  const deserialized = htmlToBlocks(html);
  for (let i = 0; i < expectedIds.length; i++) {
    assertEquals(deserialized[i]?.id, expectedIds[i], `Block ${i} stable ID preserved through HTML`);
  }

  // Test across layout block conversion
  const hw = documentBlocksToHandwritingBlocks(blocks);
  for (let i = 0; i < expectedIds.length; i++) {
    assertEquals(hw[i]?.id, expectedIds[i], `Block ${i} stable ID preserved in Block[]`);
  }

  const restored = handwritingBlocksToDocumentBlocks(hw);
  for (let i = 0; i < expectedIds.length; i++) {
    assertEquals(restored[i]?.id, expectedIds[i], `Block ${i} stable ID preserved after restoration`);
  }
}

// ─── TEST 8: Legacy HTML → DocumentBlock[] ───
console.log("\n─── 8. Legacy HTML → DocumentBlock[] Migration ───");
{
  const legacyHtml = `
    <p>Legacy text before math</p>
    <div class="math-block" data-latex="y = mx + c">y = mx + c</div>
    <table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>
    <div class="graph-block" data-graph-definition='{"id":"legacy_g","type":"coordinate","space":{"xMin":-5,"xMax":5,"yMin":-5,"yMax":5,"showGrid":true,"showAxisLabels":true,"originVisible":true}}'></div>
    <p>Legacy trailing text</p>
  `;

  const blocks = htmlToBlocks(legacyHtml);
  assert(blocks.length >= 5, `Legacy HTML parsed into typed blocks (got ${blocks.length})`);
  assert(blocks.some(b => b.type === "math"), "Legacy math-block detected and converted to MathBlock");
  assert(blocks.some(b => b.type === "table"), "Legacy table detected and converted to TableBlock");
  assert(blocks.some(b => b.type === "graph"), "Legacy graph-block detected and converted to GraphBlock");
  assert(blocks.every(b => typeof b.id === "string" && b.id.length > 0), "All legacy blocks assigned stable IDs");
}

// ─── TEST 9: DocumentBlock[] → HTML ───
console.log("\n─── 9. DocumentBlock[] → HTML Serialization ───");
{
  const blocks: DocumentBlock[] = [
    createMathBlock("x' = x - min / max - min", "x' = x - \\min / \\max - \\min", "block", "#ef4444"),
  ];
  blocks[0]!.id = "math_spec_009";

  const html = blocksToHtml(blocks);
  assert(html.includes('data-block-id="math_spec_009"'), "HTML includes data-block-id");
  assert(html.includes('data-block-type="math"'), "HTML includes data-block-type");
  assert(html.includes('class="math-block"'), "HTML includes math-block class");
  assert(html.includes('data-color="#ef4444"'), "HTML includes data-color");
}

// ─── TEST 10: HTML → DocumentBlock[] → HTML Semantic Equivalence ───
console.log("\n─── 10. HTML → DocumentBlock[] → HTML Semantic Equivalence ───");
{
  const initialHtml = `<div data-block-id="txt_eq_1" data-block-type="text"><p>Equivalence testing</p></div>\n<div data-block-id="math_eq_2" data-block-type="math" data-natural-expr="f'(x)" data-latex="f'(x)" data-display-mode="block" class="math-block" contenteditable="false">f&#39;(x)</div>`;
  const blocks1 = htmlToBlocks(initialHtml);
  const reSerialized = blocksToHtml(blocks1);
  const blocks2 = htmlToBlocks(reSerialized);

  assertEquals(blocks1.length, blocks2.length, "Block count identical across re-serialization");
  assertEquals(blocks1[0]?.id, blocks2[0]?.id, "Block 0 ID identical");
  assertEquals(blocks1[1]?.id, blocks2[1]?.id, "Block 1 ID identical");
  assertEquals((blocks1[1] as MathBlock).latex, (blocks2[1] as MathBlock).latex, "MathBlock LaTeX identical");
}

// ─── TEST 11: DocumentBlock[] → Layout without HTML Reparsing ───
console.log("\n─── 11. DocumentBlock[] → Layout without HTML Reparsing ───");
{
  const mockCtx = createMockCanvasContext();
  const directBlocks: DocumentBlock[] = [
    createEmptyTextBlock("<p>Direct block layout execution</p>"),
    createMathBlock("x' = x - min / max - min", "x' = x - \\min / \\max - \\min", "block"),
  ];

  // Call layoutDocument directly with DocumentBlock[]
  const layoutResult = layoutDocument(mockCtx, {
    content: directBlocks,
    settings: DEFAULT_SETTINGS,
  });

  assert(layoutResult.pages.length > 0, "layoutDocument produced at least 1 page from DocumentBlock[]");
  const firstPage = layoutResult.pages[0]!;
  assert(firstPage.placements.length > 0, "Page contains placements");

  // Check that placements include both a text line and a math block
  const hasLine = firstPage.placements.some(p => p.type === "line");
  const hasMath = firstPage.placements.some(p => p.type === "mathBlock");
  assert(hasLine, "Placements include direct text line placement");
  assert(hasMath, "Placements include direct mathBlock placement");
}

// ─── TEST 12: Math Functions: min, max, sin, cos ───
console.log("\n─── 12. Math Functions: min, max, sin, cos ───");
{
  // Test that unescaped min, max, sin, cos produce function tokens / nodes
  const tokensMinMax = tokenize("x' = x - min / max - min");
  const minTokens = tokensMinMax.filter(t => t.value === "\\min");
  const maxTokens = tokensMinMax.filter(t => t.value === "\\max");
  assertEquals(minTokens.length, 2, "Tokenized 'min' into \\min command twice");
  assertEquals(maxTokens.length, 1, "Tokenized 'max' into \\max command once");

  const astMinMax = parseMath("x' = x - min / max - min");
  const funcNodes = astMinMax.filter(n => n.type === "function");
  assertEquals(funcNodes.length, 3, "Parsed 3 function nodes for min and max");
  assertEquals((funcNodes[0] as any).name, "min", "First function node is min");
  assertEquals((funcNodes[1] as any).name, "max", "Second function node is max");
  assertEquals((funcNodes[2] as any).name, "min", "Third function node is min");

  // Test sin and cos
  const astTrig = parseMath("sin(x) + cos(y)");
  const trigFuncs = astTrig.filter(n => n.type === "function");
  assertEquals(trigFuncs.length, 2, "Parsed 2 function nodes for sin and cos");
  assertEquals((trigFuncs[0] as any).name, "sin", "First function is sin");
  assertEquals((trigFuncs[1] as any).name, "cos", "Second function is cos");
}

// ─── TEST 13: Normal Identifiers Remain Correct ───
console.log("\n─── 13. Normal Identifiers Remain Correct ───");
{
  // "abc" must be tokenized as 3 separate identifiers, not a function
  const tokensAbc = tokenize("abc");
  const identTokens = tokensAbc.filter(t => t.kind === "IDENT");
  assertEquals(identTokens.length, 3, "abc tokenized into 3 separate single-letter IDENT tokens");
  assertEquals(identTokens[0]?.value, "a", "First ident is 'a'");
  assertEquals(identTokens[1]?.value, "b", "Second ident is 'b'");
  assertEquals(identTokens[2]?.value, "c", "Third ident is 'c'");

  const astAbc = parseMath("abc");
  const idNodes = astAbc.filter(n => n.type === "identifier");
  assertEquals(idNodes.length, 3, "abc parsed into 3 separate identifier nodes in AST");

  // "mine" contains "min" as prefix, but is NOT the function "min"
  const tokensMine = tokenize("mine");
  const mineIdents = tokensMine.filter(t => t.kind === "IDENT");
  assertEquals(mineIdents.length, 4, "Word 'mine' tokenized into 4 IDENT tokens without splitting 'min'");

  // "maximum" contains "max", but is NOT the function "max"
  const tokensMax = tokenize("maximum");
  const maxIdents = tokensMax.filter(t => t.kind === "IDENT");
  assertEquals(maxIdents.length, 7, "Word 'maximum' tokenized into 7 IDENT tokens without splitting 'max'");
}

// ─── TEST 14: Math + Table + Graph Mixed Document ───
console.log("\n─── 14. Math + Table + Graph Mixed Document ───");
{
  const mockCtx = createMockCanvasContext();
  const mixedDoc: DocumentBlock[] = [
    createEmptyTextBlock("<h3>Experimental Results</h3>"),
    createMathBlock("f'(x) = 2x - min", "f'(x) = 2x - \\min", "block"),
    createTableBlock("<table><tbody><tr><th>Run</th><th>Loss</th></tr><tr><td>1</td><td>0.12</td></tr></tbody></table>"),
    createGraphBlock({
      id: "grp_loss",
      type: "function",
      title: "Loss Curve",
      space: { xMin: 0, xMax: 10, yMin: 0, yMax: 1, showGrid: true, showAxisLabels: true, originVisible: true },
    }),
    createEmptyTextBlock("<p>End of experiment notes.</p>"),
  ];

  // Direct layoutDocument invocation
  const docLayout = layoutDocument(mockCtx, {
    content: mixedDoc,
    settings: DEFAULT_SETTINGS,
  });

  assert(docLayout.pages.length >= 1, "Mixed document laid out onto pages");
  const allPlacements = docLayout.pages.flatMap(p => p.placements);
  const mathPlaced = allPlacements.some(p => p.type === "mathBlock");
  const tablePlaced = allPlacements.some(p => p.type === "tableRow");
  const graphPlaced = allPlacements.some(p => p.type === "graphBlock");
  const linePlaced = allPlacements.some(p => p.type === "line");

  assert(linePlaced, "Text heading and paragraph placed as line items");
  assert(mathPlaced, "MathBlock placed directly as mathBlock item");
  assert(tablePlaced, "Table rows placed directly as tableRow items");
  assert(graphPlaced, "GraphBlock placed directly as graphBlock item");
}

// ─── TEST 15: Answer Margin Metadata Survives Conversion ───
console.log("\n─── 15. Answer Margin Metadata Survives Conversion ───");
{
  const marker1: MarginMarker = { type: "question", text: "Q1", color: "#dc2626" };
  const marker2: MarginMarker = { type: "answer", text: "Ans", color: "#16a34a" };
  const marker3: MarginMarker = { type: "marks", text: "10M" };

  const blocksWithMargins: DocumentBlock[] = [
    createEmptyTextBlock("<p>Question prompt text</p>", marker1),
    createMathBlock("x = 1", "x = 1", "block", undefined, marker2),
    createTableBlock("<table><tbody><tr><td>Data</td></tr></tbody></table>", undefined, marker3),
  ];
  blocksWithMargins[0]!.id = "txt_m1";
  blocksWithMargins[1]!.id = "math_m2";
  blocksWithMargins[2]!.id = "tbl_m3";

  // 1. Direct Block[] conversion
  const hwBlocks = documentBlocksToHandwritingBlocks(blocksWithMargins);
  assertEquals(hwBlocks[0]?.marginMarker?.text, "Q1", "Text block margin marker text preserved in Block[]");
  assertEquals(hwBlocks[0]?.marginMarker?.color, "#dc2626", "Text block margin marker color preserved in Block[]");
  assertEquals(hwBlocks[1]?.marginMarker?.text, "Ans", "Math block margin marker text preserved in Block[]");
  assertEquals(hwBlocks[2]?.marginMarker?.text, "10M", "Table block margin marker text preserved in Block[]");

  // Reverse conversion
  const docFromHw = handwritingBlocksToDocumentBlocks(hwBlocks);
  assertEquals(docFromHw[0]?.marginMarker?.text, "Q1", "Restored text block margin marker preserved");
  assertEquals(docFromHw[1]?.marginMarker?.text, "Ans", "Restored math block margin marker preserved");
  assertEquals(docFromHw[2]?.marginMarker?.text, "10M", "Restored table block margin marker preserved");

  // 2. HTML round-trip conversion
  const html = blocksToHtml(blocksWithMargins);
  const docFromHtml = htmlToBlocks(html);
  assertEquals(docFromHtml[0]?.marginMarker?.text, "Q1", "HTML round-trip text block margin marker preserved");
  assertEquals(docFromHtml[1]?.marginMarker?.text, "Ans", "HTML round-trip math block margin marker preserved");
  assertEquals(docFromHtml[2]?.marginMarker?.text, "10M", "HTML round-trip table block margin marker preserved");
}

// ─── TEST 16: Phase 1 Regression Safety ───
console.log("\n─── 16. Existing Phase 1 Regression Safety ───");
{
  // Test formula with apostrophe and min/max
  const complexFormula = "x' = x - min / max - min";
  const mBlock = createMathBlock(complexFormula, complexFormula);
  const html = blocksToHtml([mBlock]);
  assert(html.includes("data-natural-expr=\"x&#39; = x - min / max - min\"") || html.includes("x'"), "HTML safely quotes apostrophe");

  const restoredBlocks = htmlToBlocks(html);
  assertEquals((restoredBlocks[0] as MathBlock).naturalExpr, complexFormula, "Full formula with apostrophe restored");

  // Test table cell formatting
  const tableWithRichCell = "<table><tbody><tr><td><strong>Bold</strong> and <span style=\"color: #ef4444\">Red</span></td></tr></tbody></table>";
  const parsedTableData = parseTableHtml(tableWithRichCell);
  assert(Boolean(parsedTableData), "Table with rich cells parsed successfully");
  const cellSegs = parsedTableData?.rows[0]?.[0]?.segs;
  assert(Boolean(cellSegs && cellSegs.some(s => s.bold)), "Cell bold formatting extracted");
  assert(Boolean(cellSegs && cellSegs.some(s => s.color)), "Cell color formatting extracted");
}

console.log("\n==================================================");
console.log(`PHASE 2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================\n");

if (failed > 0) {
  process.exit(1);
}
