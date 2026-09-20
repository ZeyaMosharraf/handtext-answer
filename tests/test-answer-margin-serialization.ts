/**
 * tests/test-answer-margin-serialization.ts
 *
 * Phase 1 Test Suite: Answer-Sheet Layout / Question Margin System
 * Verification for MarginMarker Types, Serialization, Deserialization,
 * Backward Compatibility, and Round-Trip Idempotency.
 */

import {
  type DocumentBlock,
  type TextBlock,
  type MathBlock,
  type TableBlock,
  type GraphBlock,
  type MarginMarker,
  type MarginMarkerType,
  createEmptyTextBlock,
  createMathBlock,
  createTableBlock,
  createGraphBlock,
} from "../src/types/document";
import {
  blocksToHtml,
  htmlToBlocks,
  serializeMarginMarkerAttrs,
  parseMarginMarkerFromAttributes,
} from "../src/lib/editor/blockSerialization";
import type { GraphDefinition } from "../src/lib/graph/types";
import { DEFAULT_PAGE } from "../src/lib/handwriting/types";

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

console.log("\n─── 1. PageConfig & AnswerMarginConfig Defaults ───");
assert(DEFAULT_PAGE.answerMargin !== undefined, "DEFAULT_PAGE has answerMargin defined");
assertEquals(DEFAULT_PAGE.answerMargin?.enabled, true, "AnswerMargin enabled by default");
assertEquals(DEFAULT_PAGE.answerMargin?.width, 72, "Default margin width is 72px");
assertEquals(DEFAULT_PAGE.answerMargin?.showDivider, true, "Divider visible by default");

console.log("\n─── 2. MarginMarker Data Model & Creation Helpers ───");

const qMarker: MarginMarker = { type: "question", text: "Q1" };
const ansMarker: MarginMarker = { type: "answer", text: "Ans", color: "#1d3fb5" };
const subMarker: MarginMarker = { type: "subquestion", text: "a)" };
const marksMarker: MarginMarker = { type: "marks", text: "[5M]" };
const customMarker: MarginMarker = { type: "custom", text: "Note *", color: "#b3231f" };

// TextBlock with marker
const txtWithMarker = createEmptyTextBlock("<p>This is question 1 answer text.</p>", qMarker);
assert(txtWithMarker.id.startsWith("txt_"), "TextBlock has stable txt_ id");
assertEquals(txtWithMarker.marginMarker?.type, "question", "TextBlock marginMarker type preserved");
assertEquals(txtWithMarker.marginMarker?.text, "Q1", "TextBlock marginMarker text preserved");
assertEquals(txtWithMarker.marginMarker?.color, undefined, "TextBlock marginMarker color is undefined when omitted");

// MathBlock with marker
const mathWithMarker = createMathBlock(
  "Z = X W",
  "Z = X W",
  "block",
  "#1d3fb5",
  ansMarker
);
assertEquals(mathWithMarker.marginMarker?.type, "answer", "MathBlock marginMarker type is 'answer'");
assertEquals(mathWithMarker.marginMarker?.text, "Ans", "MathBlock marginMarker text is 'Ans'");
assertEquals(mathWithMarker.marginMarker?.color, "#1d3fb5", "MathBlock marginMarker color override preserved");

// TableBlock with marker
const tableWithMarker = createTableBlock(
  "<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>",
  undefined,
  subMarker
);
assertEquals(tableWithMarker.marginMarker?.type, "subquestion", "TableBlock marginMarker type is 'subquestion'");
assertEquals(tableWithMarker.marginMarker?.text, "a)", "TableBlock marginMarker text is 'a)'");

// GraphBlock with marker
const dummyGraphDef: GraphDefinition = {
  id: "grp_1",
  type: "function",
  title: "Sine Wave",
  space: {
    xMin: -5,
    xMax: 5,
    yMin: -2,
    yMax: 2,
    showGrid: true,
    showAxisLabels: true,
    originVisible: true,
  },
  functions: [{ expression: "sin(x)", label: "sin(x)", color: "#1e3a8a" }],
};
const graphWithMarker = createGraphBlock(dummyGraphDef, marksMarker);
assertEquals(graphWithMarker.marginMarker?.type, "marks", "GraphBlock marginMarker type is 'marks'");
assertEquals(graphWithMarker.marginMarker?.text, "[5M]", "GraphBlock marginMarker text is '[5M]'");

// Blocks without markers
const txtWithoutMarker = createEmptyTextBlock("<p>Plain paragraph.</p>");
assertEquals(txtWithoutMarker.marginMarker, undefined, "TextBlock without marker has undefined marginMarker");

const mathWithoutMarker = createMathBlock("y = mx + c", "y = mx + c");
assertEquals(mathWithoutMarker.marginMarker, undefined, "MathBlock without marker has undefined marginMarker");

console.log("\n─── 3. Attribute Serialization & Deserialization Helpers ───");

// Empty / undefined markers
assertEquals(serializeMarginMarkerAttrs(undefined), "", "Undefined marker serializes to empty string");
assertEquals(serializeMarginMarkerAttrs({ type: "custom", text: "" }), "", "Empty text marker serializes to empty string");

// Valid markers
const serializedQ = serializeMarginMarkerAttrs(qMarker);
assert(serializedQ.includes('data-margin-marker="Q1"'), "Serialized contains data-margin-marker='Q1'");
assert(serializedQ.includes('data-margin-type="question"'), "Serialized contains data-margin-type='question'");
assert(!serializedQ.includes("data-margin-color"), "No data-margin-color when omitted");

const serializedAns = serializeMarginMarkerAttrs(ansMarker);
assert(serializedAns.includes('data-margin-marker="Ans"'), "Serialized contains data-margin-marker='Ans'");
assert(serializedAns.includes('data-margin-type="answer"'), "Serialized contains data-margin-type='answer'");
assert(serializedAns.includes('data-margin-color="#1d3fb5"'), "Serialized contains data-margin-color='#1d3fb5'");

// Special characters escaping
const specialMarker: MarginMarker = { type: "custom", text: 'Q & A "1" <Final>' };
const serializedSpecial = serializeMarginMarkerAttrs(specialMarker);
assert(serializedSpecial.includes("data-margin-marker=\"Q &amp; A &quot;1&quot; &lt;Final&gt;\""), "Special characters escaped in attributes");

// Parsing attributes
const parsedSpecial = parseMarginMarkerFromAttributes('Q & A "1" <Final>', "custom");
assertEquals(parsedSpecial?.text, 'Q & A "1" <Final>', "Special characters unescaped cleanly");
assertEquals(parsedSpecial?.type, "custom", "Type preserved as custom");

// Fallback for invalid types
const parsedInvalidType = parseMarginMarkerFromAttributes("Q2", "unrecognized_type");
assertEquals(parsedInvalidType?.type, "custom", "Invalid type falls back to 'custom'");

// Color preservation in parser
const parsedWithColor = parseMarginMarkerFromAttributes("Ans 1", "answer", "#ff0000");
assertEquals(parsedWithColor?.color, "#ff0000", "Custom color parsed");

console.log("\n─── 4. Full DocumentBlock Serialization & HTML Attributes ───");

const testDoc: DocumentBlock[] = [
  txtWithMarker,
  mathWithMarker,
  txtWithoutMarker,
  tableWithMarker,
  graphWithMarker,
];

const htmlOutput = blocksToHtml(testDoc);
assert(htmlOutput.includes(`data-block-id="${txtWithMarker.id}"`), "HTML has txtWithMarker ID");
assert(htmlOutput.includes('data-margin-marker="Q1"'), "HTML has data-margin-marker='Q1'");
assert(htmlOutput.includes('data-margin-type="question"'), "HTML has data-margin-type='question'");

assert(htmlOutput.includes(`data-block-id="${mathWithMarker.id}"`), "HTML has mathWithMarker ID");
assert(htmlOutput.includes('data-margin-marker="Ans"'), "HTML has data-margin-marker='Ans'");
assert(htmlOutput.includes('data-margin-type="answer"'), "HTML has data-margin-type='answer'");
assert(htmlOutput.includes('data-margin-color="#1d3fb5"'), "HTML has data-margin-color='#1d3fb5'");

assert(htmlOutput.includes(`data-block-id="${tableWithMarker.id}"`), "HTML has tableWithMarker ID");
assert(htmlOutput.includes('data-margin-marker="a)"'), "HTML has data-margin-marker='a)'");
assert(htmlOutput.includes('data-margin-type="subquestion"'), "HTML has data-margin-type='subquestion'");

assert(htmlOutput.includes(`data-block-id="${graphWithMarker.id}"`), "HTML has graphWithMarker ID");
assert(htmlOutput.includes('data-margin-marker="[5M]"'), "HTML has data-margin-marker='[5M]'");
assert(htmlOutput.includes('data-margin-type="marks"'), "HTML has data-margin-type='marks'");

console.log("\n─── 5. Deserialization & Round-Trip Idempotency ───");

const restoredBlocks = htmlToBlocks(htmlOutput);
assertEquals(restoredBlocks.length, testDoc.length, "Restored count matches original count (5 blocks)");

// Block 0: Text with Q1
const r0 = restoredBlocks[0] as TextBlock;
assertEquals(r0.id, txtWithMarker.id, "Block 0 ID matches");
assertEquals(r0.type, "text", "Block 0 type is text");
assertEquals(r0.marginMarker?.text, "Q1", "Block 0 marginMarker text restored as 'Q1'");
assertEquals(r0.marginMarker?.type, "question", "Block 0 marginMarker type restored as 'question'");
assertEquals(r0.marginMarker?.color, undefined, "Block 0 marginMarker color is undefined");

// Block 1: Math with Ans and color
const r1 = restoredBlocks[1] as MathBlock;
assertEquals(r1.id, mathWithMarker.id, "Block 1 ID matches");
assertEquals(r1.type, "math", "Block 1 type is math");
assertEquals(r1.marginMarker?.text, "Ans", "Block 1 marginMarker text restored as 'Ans'");
assertEquals(r1.marginMarker?.type, "answer", "Block 1 marginMarker type restored as 'answer'");
assertEquals(r1.marginMarker?.color, "#1d3fb5", "Block 1 marginMarker color restored");
assertEquals(r1.color, "#1d3fb5", "Block 1 MathBlock color attribute intact");

// Block 2: Text WITHOUT marker
const r2 = restoredBlocks[2] as TextBlock;
assertEquals(r2.id, txtWithoutMarker.id, "Block 2 ID matches");
assertEquals(r2.type, "text", "Block 2 type is text");
assertEquals(r2.marginMarker, undefined, "Block 2 has NO marginMarker (undefined)");

// Block 3: Table with a)
const r3 = restoredBlocks[3] as TableBlock;
assertEquals(r3.id, tableWithMarker.id, "Block 3 ID matches");
assertEquals(r3.type, "table", "Block 3 type is table");
assertEquals(r3.marginMarker?.text, "a)", "Block 3 marginMarker text restored as 'a)'");
assertEquals(r3.marginMarker?.type, "subquestion", "Block 3 marginMarker type restored as 'subquestion'");

// Block 4: Graph with [5M]
const r4 = restoredBlocks[4] as GraphBlock;
assertEquals(r4.id, graphWithMarker.id, "Block 4 ID matches");
assertEquals(r4.type, "graph", "Block 4 type is graph");
assertEquals(r4.marginMarker?.text, "[5M]", "Block 4 marginMarker text restored as '[5M]'");
assertEquals(r4.marginMarker?.type, "marks", "Block 4 marginMarker type restored as 'marks'");

// Round-trip idempotency test
const secondHtml = blocksToHtml(restoredBlocks);
assertEquals(secondHtml, htmlOutput, "Second serialization cycle produces 100% byte-identical HTML");

const secondRestored = htmlToBlocks(secondHtml);
assertEquals(secondRestored.length, restoredBlocks.length, "Second restored count matches");
assertEquals((secondRestored[0] as TextBlock).marginMarker?.text, "Q1", "Second restored marker text matches");

console.log("\n─── 6. Legacy Documents & Backward Compatibility ───");

// Document containing legacy HTML without any data-margin-marker
const legacyHtmlWithoutMarkers = `
  <div data-block-id="txt_legacy_1" data-block-type="text"><p>Introduction paragraph without markers.</p></div>
  <div data-block-id="math_legacy_1" data-block-type="math" data-latex="E = mc^2" data-natural-expr="E = mc^2" class="math-block">E = mc^2</div>
  <div data-block-id="tbl_legacy_1" data-block-type="table"><table><tbody><tr><td>Cell 1</td></tr></tbody></table></div>
  <div data-block-id="grp_legacy_1" data-block-type="graph" data-graph-definition="${JSON.stringify(dummyGraphDef).replace(/"/g, "&quot;")}" class="graph-block"></div>
`;

const legacyParsed = htmlToBlocks(legacyHtmlWithoutMarkers);
assertEquals(legacyParsed.length, 4, "Legacy document parsed 4 blocks");
for (let i = 0; i < legacyParsed.length; i++) {
  assertEquals(legacyParsed[i]?.marginMarker, undefined, `Legacy block ${i} (${legacyParsed[i]?.type}) has marginMarker === undefined`);
}

// Unadorned legacy HTML (no data-block-id, no data-block-type)
const unadornedLegacyHtml = `
  <h2>Question Section</h2>
  <p>Some plain text description.</p>
  <div class="math-block" data-latex="\\int x dx">\\int x dx</div>
  <table><tbody><tr><td>Table cell</td></tr></tbody></table>
`;
const unadornedParsed = htmlToBlocks(unadornedLegacyHtml);
assert(unadornedParsed.length >= 3, `Unadorned legacy produced ${unadornedParsed.length} blocks`);
for (const b of unadornedParsed) {
  assertEquals(b.marginMarker, undefined, `Unadorned block ${b.type} has marginMarker === undefined`);
}

// Legacy HTML with embedded data-margin-marker on <p> or <div> (e.g. partial migration / external input)
const embeddedMarkerHtml = `
  <p data-margin-marker="Q3" data-margin-type="question">What is machine learning?</p>
  <div class="math-block" data-margin-marker="Ans" data-margin-type="answer" data-latex="y = f(x)">y = f(x)</div>
`;
const embeddedParsed = htmlToBlocks(embeddedMarkerHtml);
assertEquals(embeddedParsed[0]?.marginMarker?.text, "Q3", "Embedded <p data-margin-marker='Q3'> parsed correctly");
assertEquals(embeddedParsed[0]?.marginMarker?.type, "question", "Embedded type parsed correctly");
assertEquals(embeddedParsed[1]?.marginMarker?.text, "Ans", "Embedded math data-margin-marker parsed correctly");

console.log("\n─── 7. All MarginMarker Types & Custom Values ───");

const allTypesDoc: DocumentBlock[] = [
  createEmptyTextBlock("<p>Question block</p>", { type: "question", text: "Q10" }),
  createEmptyTextBlock("<p>Answer block</p>", { type: "answer", text: "Ans." }),
  createEmptyTextBlock("<p>Subquestion block</p>", { type: "subquestion", text: "(ii)" }),
  createEmptyTextBlock("<p>Marks block</p>", { type: "marks", text: "[15M]" }),
  createEmptyTextBlock("<p>Custom block</p>", { type: "custom", text: "OR", color: "#c0392b" }),
];

const allTypesHtml = blocksToHtml(allTypesDoc);
const allTypesRestored = htmlToBlocks(allTypesHtml);

assertEquals((allTypesRestored[0] as TextBlock).marginMarker?.type, "question", "type 'question' roundtrips");
assertEquals((allTypesRestored[0] as TextBlock).marginMarker?.text, "Q10", "text 'Q10' roundtrips");

assertEquals((allTypesRestored[1] as TextBlock).marginMarker?.type, "answer", "type 'answer' roundtrips");
assertEquals((allTypesRestored[1] as TextBlock).marginMarker?.text, "Ans.", "text 'Ans.' roundtrips");

assertEquals((allTypesRestored[2] as TextBlock).marginMarker?.type, "subquestion", "type 'subquestion' roundtrips");
assertEquals((allTypesRestored[2] as TextBlock).marginMarker?.text, "(ii)", "text '(ii)' roundtrips");

assertEquals((allTypesRestored[3] as TextBlock).marginMarker?.type, "marks", "type 'marks' roundtrips");
assertEquals((allTypesRestored[3] as TextBlock).marginMarker?.text, "[15M]", "text '[15M]' roundtrips");

assertEquals((allTypesRestored[4] as TextBlock).marginMarker?.type, "custom", "type 'custom' roundtrips");
assertEquals((allTypesRestored[4] as TextBlock).marginMarker?.text, "OR", "text 'OR' roundtrips");
assertEquals((allTypesRestored[4] as TextBlock).marginMarker?.color, "#c0392b", "custom color '#c0392b' roundtrips");

console.log("\n══════════════════════════════════════");
console.log(`Phase 1 Test Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.error("Some Phase 1 tests failed!");
  process.exit(1);
} else {
  console.log("All Phase 1 Answer Margin tests passed successfully! ✓\n");
}
